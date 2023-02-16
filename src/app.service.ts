import { Injectable, OnApplicationBootstrap } from '@nestjs/common'
import { AddressLookupTableProgram, Connection, PartiallyDecodedInstruction, PublicKey } from '@solana/web3.js'
import axios from 'axios';
import { base58_to_binary } from 'base58-js'
import { stringify } from 'querystring';
import { PrismaService } from './prisma.service'

@Injectable()
export class AppService implements OnApplicationBootstrap {

	private tableRecords: TableRecord[];
	private connection: Connection;

	constructor(private readonly prisma: PrismaService) {
		console.log(process.env.SOLANA_RPC);
		this.connection = new Connection(process.env.SOLANA_RPC);
	}

	async onApplicationBootstrap() {
		this.tableRecords = await this.prisma.tableRecord.findMany();
		this.processOld();
	}

	async processOld() {
		const lastCompletedPoint = (await this.prisma.checkpoint.findFirst({where: { key: 'LAST_SOLANA_SIG' }})).sig;
		let before = null;
		let marker = null;
		let until = lastCompletedPoint;
		for(;;) {
			const tableSet = new Set<string>();
			const {data: heliusData} = await axios.get<HeliusTransaction[]>(`https://api.helius.xyz/v0/addresses/${AddressLookupTableProgram.programId.toString()}/transactions`, {
				params: {
					'api-key': process.env.HELIUS_KEY,
					before,
					until,
				}
			});

			if (heliusData.length === 0) {
				break;
			}

			if (marker === null) {
				marker = heliusData[0].signature;
			}

			for (let trx of heliusData) {
				for (let ins of trx.instructions) {
					if (ins.programId === AddressLookupTableProgram.programId.toString()) {
						const address = this.getTableAddress(ins);
						if (address) {
							tableSet.add(address);
						}
					}
				}
			}

			for(let addr of tableSet) {
				await this.checkTable(new PublicKey(addr));
			}

			before = heliusData[heliusData.length - 1].signature;
			await wait(1000);
		}

		if (marker) {
			await this.prisma.checkpoint.update({
				where: { key: 'LAST_SOLANA_SIG' },
				data: { sig: marker },
			});
		}
		console.log('process old finished');
	}

	getTableAddress(ins: HeliusInstruction) {
		const data = base58_to_binary(ins.data);
		const insNumber = Buffer.from(data).readUInt32LE(0);
		if (insNumber === 2 || insNumber === 3) {
			return ins.accounts[0];
		}
		return null;
	}
	
	async processTransaction(signature: string) {
		console.log('processing signature', signature);
		let trx;
		try {
			trx = await this.connection.getParsedTransaction(signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
		} catch(err) {
			console.log('OMG', err);
			throw err;
		}

		if (!trx) {
			console.log(`trx ${signature} is null (not ready for parse)`);
			throw new Error('parse trx failed');
		}
		if (trx.meta.err) {
			console.log('trx has error', signature);
			return;
		}

		const lookupInstructions: PartiallyDecodedInstruction[] = trx.transaction.message.instructions.filter(ins => ins.programId.equals(AddressLookupTableProgram.programId));

		for (let ins of lookupInstructions) {
			await this.processRawIns(ins);
		}
	}

	async findTables(accounts: Set<string>): Promise<{ matchedTables: string[], matchedAccounts: string[] }> {
		let heatTable : {[addr: string]: {count: number, included: boolean}} = {};
		let candidateTables: Array<string> = [];
		for (let acc of accounts) {
			const tables = this.tableRecords.filter(l => l.account === acc);
			for (let j=0; j<tables.length; j++) {
				const addr = tables[j].table;
				if (!heatTable[addr]) {
					heatTable[addr] = { count: 1, included: false };
				} else {
					heatTable[addr].count++;
				}
				if (heatTable[addr].count === 2) {
					candidateTables.push(addr);	
				}
			}
		}

		const sortedTables = candidateTables.sort((a, b) => heatTable[a].count > heatTable[b].count ? -1 : 1);

		let matchedAccounts = [];
		const matchedTables = [];
		for (let table of sortedTables) {
			const trs = this.tableRecords.filter(tr => tr.table === table && accounts.has(tr.account));
			for (let tr of trs) {
				if (!matchedAccounts.find(ma => ma === tr.account)) {
					matchedAccounts = matchedAccounts.concat(trs.map(t => t.account));
					matchedTables.push(table);
					break;
				}
			}
		}
		return { matchedTables, matchedAccounts };
	}

	async processRawIns(ins: PartiallyDecodedInstruction) {
		const data = base58_to_binary(ins.data);
		const insNumber = Buffer.from(data).readUInt32LE(0);
		if (insNumber === 2 || insNumber === 3) {
			await this.checkTable(ins.accounts[0]);
		}
	}

	async checkTable(addrKey: PublicKey) {
		console.log('checking table...', addrKey.toString());
		const res = await this.connection.getAddressLookupTable(addrKey);
		if (!res || !res.value || !res.value.isActive) {
			this.tableRecords = this.tableRecords.filter(tr => tr.table !== addrKey.toString());
			await this.prisma.tableRecord.deleteMany({
				where: { table: addrKey.toString() }
			});
			return;
		}
		const lookupTable = res.value;
		for (let addrKey of lookupTable.state.addresses) {
			const addr = addrKey.toString();
			const record = this.tableRecords.find(tr => tr.table === addr && tr.account === addr);
			if (!record) {
				this.tableRecords.push({table: lookupTable.key.toString(), account: addr});
				await this.prisma.tableRecord.upsert({
					where: {table_account: { table: lookupTable.key.toString(), account: addr }},
					create: { table: lookupTable.key.toString(), account: addr },
					update: {}
				});
			}
		}
		console.log('checked table', addrKey.toString());
	}

	async getStats(): Promise<{accounts: number, tables: number, duplicates: number}> {
		const tablesSet = new Set(this.tableRecords.map(tr => tr.table));
		const accountsSet = new Set(this.tableRecords.map(tr => tr.account));
		return {
			accounts: this.tableRecords.length,
			tables: tablesSet.size,
			duplicates: (this.tableRecords.length - accountsSet.size) / this.tableRecords.length
		}
	}
}

function wait(time: number) : Promise<void> {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, time);
    });
}

type TableRecord = { account: string, table: string }

type HeliusInstruction = {
	accounts: string[],
	data: string,
	programId: string,
}

type HeliusTransaction = {
	signature: string,
	instructions: HeliusInstruction[],
}
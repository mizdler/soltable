import { Injectable, OnApplicationBootstrap } from '@nestjs/common'
import { AddressLookupTableProgram, Connection, PartiallyDecodedInstruction, PublicKey } from '@solana/web3.js'
import axios from 'axios';
import { base58_to_binary } from 'base58-js'
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
		// await this.processOld();
	}

	async processOld() {
		const lastCompletedPoint = (await this.prisma.checkpoint.findFirst({where: { key: 'LAST_SOLANA_SIG' }})).sig;
		const firstCompletedSig = (await this.prisma.checkpoint.findFirst({where: { key: 'FIRST_SOLANA_SIG' }})).sig;
		let before = firstCompletedSig;
		let marker = null;
		let until = firstCompletedSig ? null : lastCompletedPoint;
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

			let x = 0;

			for (let trx of heliusData) {
				let y = 0;
				for (let ins of trx.instructions) {
					if (ins.programId === AddressLookupTableProgram.programId.toString()) {
						console.log('trx, ins', x++, y++);
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
			await this.prisma.checkpoint.update({
				where: { key: 'FIRST_SOLANA_SIG' },
				data: { sig: before },
			});

			if (marker == null && firstCompletedSig == null) {
				marker = heliusData[0].signature;
				await this.prisma.checkpoint.update({
					where: { key: 'LAST_SOLANA_SIG' },
					data: { sig: marker },
				});
			}
		}

		// await this.prisma.checkpoint.update({
		// 	where: { key: 'LAST_SOLANA_SIG' },
		// 	data: { sig: tempSig },
		// });

		await this.prisma.checkpoint.update({
			where: { key: 'FIRST_SOLANA_SIG' },
			data: { sig: null },
		});
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

		const lookupTableAddresses: string[] = [];
		for (let ins of lookupInstructions) {
			await this.processRawIns(ins);
		}
	}

	async findTables(accounts: string[]): Promise<string[]> {
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

		return candidateTables.sort((a, b) => heatTable[a].count > heatTable[b].count ? -1 : 1);
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
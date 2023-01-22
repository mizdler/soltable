import { Injectable, OnApplicationBootstrap } from '@nestjs/common'
import { AddressLookupTableProgram, Connection, PartiallyDecodedInstruction } from '@solana/web3.js'
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
			await this.processIns(ins);
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

	async processIns(ins: PartiallyDecodedInstruction) {
		const data = base58_to_binary(ins.data);
		const insNumber = Buffer.from(data).readUInt32LE(0);
		const lookupTable = await (await this.connection.getAddressLookupTable(ins.accounts[0])).value;
		if (insNumber === 2) { // extend
			for (let addr in lookupTable.state.addresses) {
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
		} else if (insNumber === 3) {	// deactive
			this.tableRecords = this.tableRecords.filter(tr => tr.table !== lookupTable.key.toString());
			await this.prisma.tableRecord.deleteMany({
				where: { table: lookupTable.key.toString() }
			});
		}
	}
}

type TableRecord = { account: string, table: string }

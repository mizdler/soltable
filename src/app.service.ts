import { Injectable, OnApplicationBootstrap } from '@nestjs/common';

@Injectable()
export class AppService implements OnApplicationBootstrap {

	private tableRecords: TableRecord[];

	getHello(): string {
		return 'Hello World!';
	}

	async onApplicationBootstrap() {
		
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
}

type TableRecord = { account: string, table: string }

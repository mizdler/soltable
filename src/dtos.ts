import { ApiProperty } from "@nestjs/swagger";

export class TableResult {
	@ApiProperty()
	matchedTables: string[];

	@ApiProperty()
	matchedAccounts: string[];
}

export class Stats {
	@ApiProperty()
	accounts: number;
	
	@ApiProperty()
	tables: number;

	@ApiProperty()
	duplicates: number;
}
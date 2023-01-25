import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Post } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Stats, TableResult } from './dtos';


@Controller()
export class AppController {
	constructor(private readonly appService: AppService) {}

	@Post('/index')
	async index(@Body() body: any) {
	  console.log('helius body:', body)
	  await this.appService.processTransaction(body[0].signature);
	}

	@ApiOkResponse({
		description: 'Finds the optimal ALTs',
		type: TableResult,
	})
	@Post('/findTables')
	@HttpCode(200)
	async findTables(@Body() accounts: string[]): Promise<TableResult> {
		if (accounts.length > 256) {
			throw new HttpException('accounts too large', HttpStatus.NOT_ACCEPTABLE);
		}
		return this.appService.findTables(new Set(accounts));
	}

	@ApiOkResponse({
		description: 'Stats of Soltable',
		type: Stats,
	})
	@Get('/stats')
	async stats(): Promise<Stats> {
		return this.appService.getStats();
	}
}
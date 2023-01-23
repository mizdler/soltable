import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Post } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
	constructor(private readonly appService: AppService) {}

	@Post('/index')
	async index(@Body() body: any) {
	  console.log('helius body:', body)
	  await this.appService.processTransaction(body[0].signature);
	}

	@Post('/findTables')
	@HttpCode(200)
	async findTables(@Body() accounts: string[]): Promise<{ matchedTables: string[], matchedAccounts: string[] }> {
		if (accounts.length > 256) {
			throw new HttpException('accounts too large', HttpStatus.NOT_ACCEPTABLE);
		}
		return this.appService.findTables(new Set(accounts));
	}

	@Get('/stat')
	async stat() {
		// return this.appService.getStat();
	}
}

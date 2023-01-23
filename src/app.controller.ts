import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
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
	async findTables(@Body() accounts: string[]): Promise<string[]> {
		return this.appService.findTables(accounts);
	}

	@Get('/stat')
	async stat() {
		// return this.appService.getStat();
	}
}

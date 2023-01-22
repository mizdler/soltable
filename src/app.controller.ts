import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
	constructor(private readonly appService: AppService) {}

	@Post('/')
	async heliusWebook(@Body() body: any) {
	  console.log('helius body:', body)
	  await this.appService.processTransaction(body[0].signature);
	}

	@Post('/findTables')
	@HttpCode(200)
	async findTables(accounts: string[]): Promise<string[]> {
		return this.appService.findTables(accounts);
	}
}

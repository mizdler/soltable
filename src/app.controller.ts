import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
	constructor(private readonly appService: AppService) {}

	@Get()
	getHello(): string {
		return this.appService.getHello();
	}

	@Post('/findTables')
	@HttpCode(200)
	async findTables(accounts: string[]): Promise<string[]> {
		return this.appService.findTables(accounts);
	}
}

import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	setupSwagger(app);

	app.enableCors({
		origin: '*',
		allowedHeaders: '*',
		credentials: true,
	});
	await app.listen(3000);
}


function setupSwagger(app: INestApplication) {
	const config = new DocumentBuilder()
		.setTitle('Soltable API')
		.setDescription('...')
		.setVersion('1.0')
		.build();

	const document = SwaggerModule.createDocument(app, config);

	SwaggerModule.setup('swagger', app, document);
}
bootstrap();

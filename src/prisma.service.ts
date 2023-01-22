import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from 'prisma/prisma-client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
   async onModuleInit() {
      await this.$connect();
   }

   /**
    * This will be called in the app's main.ts file
    *
    * @see https://docs.nestjs.com/recipes/prisma#issues-with-enableshutdownhooks
    *
    * @param app
    */
   async enableShutdownHooks(app: INestApplication) {
      this.$on('beforeExit', async () => {
         await app.close();
      });
   }
}

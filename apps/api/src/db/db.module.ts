import { Global, Module } from '@nestjs/common';
import { DbService } from './db.service';
import { TenantInterceptor } from './tenant.interceptor';

@Global()
@Module({
  providers: [DbService, TenantInterceptor],
  exports: [DbService, TenantInterceptor],
})
export class DbModule {}

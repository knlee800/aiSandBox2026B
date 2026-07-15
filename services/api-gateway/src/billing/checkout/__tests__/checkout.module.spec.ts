import { CheckoutModule } from '../checkout.module';
import { CheckoutController } from '../checkout.controller';
import { CheckoutService } from '../checkout.service';

describe('CheckoutModule', () => {
  it('should be defined', () => {
    expect(CheckoutModule).toBeDefined();
  });

  it('should reference CheckoutController', () => {
    const metadata = Reflect.getMetadata('controllers', CheckoutModule);
    expect(metadata).toContain(CheckoutController);
  });

  it('should provide CheckoutService', () => {
    const providers = Reflect.getMetadata('providers', CheckoutModule);
    expect(providers).toContain(CheckoutService);
  });

  it('should export CheckoutService', () => {
    const exports = Reflect.getMetadata('exports', CheckoutModule);
    expect(exports).toContain(CheckoutService);
  });
});

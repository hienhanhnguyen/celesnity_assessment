import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { decryptSecret, encryptSecret, parseKey, type EncryptedSecret } from './crypto';

@Injectable()
export class CryptoService {
  private readonly key: string;

  constructor(config: AppConfigService) {
    this.key = config.secrets.encryptionKey;
    parseKey(this.key); // fail fast if the key is miss or has wrong length
  }

  encrypt(plaintext: string): EncryptedSecret {
    return encryptSecret(plaintext, this.key);
  }

  decrypt(secret: EncryptedSecret): string {
    return decryptSecret(secret, this.key);
  }
}

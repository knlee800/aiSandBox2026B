import { IsString, Validate, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import {
  APP_PASSWORD_MESSAGE,
  ICAL_URL_MESSAGE,
  IMAP_PRESET_MESSAGE,
  ImapPreset,
  USERNAME_MESSAGE,
  isConnectorAppPassword,
  isConnectorIcalUrl,
  isConnectorUsername,
  isImapPreset,
} from '../connector-rules';

@ValidatorConstraint({ name: 'connectorImapPreset', async: false })
export class ConnectorImapPresetConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return isImapPreset(value);
  }

  defaultMessage(): string {
    return IMAP_PRESET_MESSAGE;
  }
}

@ValidatorConstraint({ name: 'connectorUsername', async: false })
export class ConnectorUsernameConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return isConnectorUsername(value);
  }

  defaultMessage(): string {
    return USERNAME_MESSAGE;
  }
}

@ValidatorConstraint({ name: 'connectorAppPassword', async: false })
export class ConnectorAppPasswordConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return isConnectorAppPassword(value);
  }

  defaultMessage(): string {
    return APP_PASSWORD_MESSAGE;
  }
}

@ValidatorConstraint({ name: 'connectorIcalUrl', async: false })
export class ConnectorIcalUrlConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return isConnectorIcalUrl(value);
  }

  defaultMessage(): string {
    return ICAL_URL_MESSAGE;
  }
}

export class ConnectImapDto {
  @IsString({ message: IMAP_PRESET_MESSAGE })
  @Validate(ConnectorImapPresetConstraint)
  preset: ImapPreset;

  @IsString({ message: USERNAME_MESSAGE })
  @Validate(ConnectorUsernameConstraint)
  username: string;

  @IsString({ message: APP_PASSWORD_MESSAGE })
  @Validate(ConnectorAppPasswordConstraint)
  appPassword: string;
}

export class ConnectIcalDto {
  @IsString({ message: ICAL_URL_MESSAGE })
  @Validate(ConnectorIcalUrlConstraint)
  url: string;
}

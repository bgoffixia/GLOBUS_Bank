import type { OptionalSignupProfile } from '../lib/signup-flow';
import { useLanguage } from '../lib/i18n';

type SignupOptionalProfileFieldsProps = {
  values: OptionalSignupProfile;
  onChange: <K extends keyof OptionalSignupProfile>(
    field: K,
    value: string,
  ) => void;
};

export function SignupOptionalProfileFields({
  values,
  onChange,
}: SignupOptionalProfileFieldsProps) {
  const { t } = useLanguage();
  return (
    <>
      <div className="gb-field gb-field-wide">
        <label className="gb-field-label" htmlFor="gb-signup-address">{t('Address')}</label>
        <textarea id="gb-signup-address" data-testid="input-signup-address" autoComplete="street-address" maxLength={1024} value={values.address ?? ''} onChange={event => onChange('address', event.target.value)} className="gb-input min-h-[64px] resize-y py-2" rows={2} />
      </div>
      <div className="gb-field">
        <label className="gb-field-label" htmlFor="gb-signup-country">{t('Country of origin')}</label>
        <input id="gb-signup-country" data-testid="input-signup-country" className="gb-input" type="text" autoComplete="country-name" maxLength={1024} value={values.country ?? ''} onChange={event => onChange('country', event.target.value)} />
      </div>
      <div className="gb-field">
        <label className="gb-field-label" htmlFor="gb-signup-city">{t('City of origin')}</label>
        <input id="gb-signup-city" data-testid="input-signup-city" className="gb-input" type="text" autoComplete="address-level2" maxLength={1024} value={values.cityOfOrigin ?? ''} onChange={event => onChange('cityOfOrigin', event.target.value)} />
      </div>
      <div className="gb-field">
        <label className="gb-field-label" htmlFor="gb-signup-dob">{t('Date of birth')}</label>
        <input id="gb-signup-dob" data-testid="input-signup-date-of-birth" className="gb-input" type="date" autoComplete="bday" max={new Date().toISOString().slice(0, 10)} value={values.dateOfBirth ?? ''} onChange={event => onChange('dateOfBirth', event.target.value)} />
      </div>
      <div className="gb-field">
        <label className="gb-field-label" htmlFor="gb-signup-occupation">{t('Occupation / employment status')}</label>
        <input id="gb-signup-occupation" data-testid="input-signup-occupation" className="gb-input" type="text" autoComplete="organization-title" maxLength={1024} value={values.occupation ?? ''} onChange={event => onChange('occupation', event.target.value)} />
      </div>
      <div className="gb-field">
        <label className="gb-field-label" htmlFor="gb-signup-phone">{t('Phone number')}</label>
        <input id="gb-signup-phone" data-testid="input-signup-phone" className="gb-input" type="tel" autoComplete="tel" maxLength={1024} value={values.phone ?? ''} onChange={event => onChange('phone', event.target.value)} />
      </div>
    </>
  );
}

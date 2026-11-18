import type { OptionalSignupProfile } from '../lib/signup-flow';

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
  return (
    <>
      <div className="gb-field">
        <label className="gb-field-label" htmlFor="gb-signup-country">Country of origin</label>
        <input id="gb-signup-country" data-testid="input-signup-country" className="gb-input" type="text" autoComplete="country-name" maxLength={80} value={values.country ?? ''} onChange={event => onChange('country', event.target.value)} />
      </div>
      <div className="gb-field">
        <label className="gb-field-label" htmlFor="gb-signup-city">City of origin</label>
        <input id="gb-signup-city" data-testid="input-signup-city" className="gb-input" type="text" autoComplete="address-level2" maxLength={100} value={values.cityOfOrigin ?? ''} onChange={event => onChange('cityOfOrigin', event.target.value)} />
      </div>
      <div className="gb-field">
        <label className="gb-field-label" htmlFor="gb-signup-dob">Date of birth</label>
        <input id="gb-signup-dob" data-testid="input-signup-date-of-birth" className="gb-input" type="date" autoComplete="bday" max={new Date().toISOString().slice(0, 10)} value={values.dateOfBirth ?? ''} onChange={event => onChange('dateOfBirth', event.target.value)} />
      </div>
      <div className="gb-field">
        <label className="gb-field-label" htmlFor="gb-signup-occupation">Occupation / employment status</label>
        <input id="gb-signup-occupation" data-testid="input-signup-occupation" className="gb-input" type="text" autoComplete="organization-title" maxLength={100} value={values.occupation ?? ''} onChange={event => onChange('occupation', event.target.value)} />
      </div>
      <div className="gb-field">
        <label className="gb-field-label" htmlFor="gb-signup-phone">Phone number</label>
        <input id="gb-signup-phone" data-testid="input-signup-phone" className="gb-input" type="tel" autoComplete="tel" maxLength={32} value={values.phone ?? ''} onChange={event => onChange('phone', event.target.value)} />
      </div>
    </>
  );
}

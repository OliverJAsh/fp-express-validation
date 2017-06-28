import * as array from 'fp-ts/lib/Array';
import * as either from 'fp-ts/lib/Either';
import * as option from 'fp-ts/lib/Option';
import { Option } from 'fp-ts/lib/Option';
import * as t from 'io-ts';
import { formatValidationError } from 'io-ts-reporters/target/src';

const parseNumber = (s: string): Option<number> => {
    const n = parseFloat(s);
    return isNaN(n) ? option.zero() : option.some(n);
};
export const NumberFromString = t.prism(t.string, parseNumber, 'NumberFromString');

export const JSONFromString = t.prism(
    t.string,
    s => either.tryCatch<JSON>(() => JSON.parse(s)).toOption(),
    'JSONFromString',
);

export const composeTypes = <A, B>(fa: t.Type<A>, fb: t.Type<B>, name: string): t.Type<B> =>
    new t.Type<B>(name, (v, c) => fa.validate(v, c).chain(a => fb.validate(a, c)));

export const formatValidationErrors = (validationErrors: t.ValidationError[]) =>
    array.catOptions(validationErrors.map(formatValidationError));

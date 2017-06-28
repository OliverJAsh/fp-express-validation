import * as array from 'fp-ts/lib/Array';
import * as option from 'fp-ts/lib/Option';
import { Option } from 'fp-ts/lib/Option';
import * as t from 'io-ts';
import { formatValidationError } from 'io-ts-reporters/target/src';

const parseNumber = (s: string): Option<number> => {
    const n = parseFloat(s);
    return isNaN(n) ? option.zero() : option.some(n);
};
export const NumberFromString = t.prism(t.string, parseNumber, 'NumberFromString');

export const formatValidationErrors = (validationErrors: t.ValidationError[]) =>
    array.catOptions(validationErrors.map(formatValidationError));

import { CountryCode, countryByCode } from "./country";
import { BbanStructure } from "./bbanStructure";
import { PartType, CharacterType, BbanStructurePart } from "./structurePart";
import {
  InvalidCheckDigitException,
  IbanFormatException,
  FormatViolation,
  UnsupportedCountryException,
} from "./exceptions";

const ucRegex = /^[A-Z]+$/;
const numRegex = /^[0-9]+$/;

/**
 * Iban Utility Class
 */
export const DEFAULT_CHECK_DIGIT = "00";
const MOD = 97;
const MAX = 999999999;

const COUNTRY_CODE_INDEX = 0;
const COUNTRY_CODE_LENGTH = 2;
const CHECK_DIGIT_INDEX = COUNTRY_CODE_LENGTH;
const CHECK_DIGIT_LENGTH = 2;
const BBAN_INDEX = CHECK_DIGIT_INDEX + CHECK_DIGIT_LENGTH;

/**
 * Calculates Iban
 * <a href="http://en.wikipedia.org/wiki/ISO_13616#Generating_IBAN_check_digits">Check Digit</a>.
 *
 * @param iban string value
 * @throws IbanFormatException if iban contains invalid character.
 *
 * @return check digit as String
 */
export function calculateCheckDigit(iban: string): string {
  const reformattedIban = replaceCheckDigit(iban, DEFAULT_CHECK_DIGIT);
  const modResult = calculateMod(reformattedIban);
  const checkDigit = String(98 - modResult);

  return checkDigit.padStart(2, "0");
}

/**
 * Validates iban.
 *
 * @param iban to be validated.
 * @throws IbanFormatException if iban is invalid.
 *         UnsupportedCountryException if iban's country is not supported.
 *         InvalidCheckDigitException if iban has invalid check digit.
 */
export function validate(iban: string) {
  validateEmpty(iban);
  validateCountryCode(iban);
  validateCheckDigitPresence(iban);

  const structure = getBbanStructure(iban);

  if (!structure) {
    throw new Error("Internal error, expected structure");
  }

  validateBbanLength(iban, structure);
  validateBbanEntries(iban, structure);

  validateCheckDigit(iban);
}

/**
 * Checks whether country is supporting iban.
 * @param countryCode {@link org.iban4j.CountryCode}
 *
 * @return boolean true if country supports iban, false otherwise.
 */
export function isSupportedCountry(countryCode: CountryCode): boolean {
  return BbanStructure.forCountry(countryCode) != null;
}

/**
 * Returns iban length for the specified country.
 *
 * @param countryCode {@link org.iban4j.CountryCode}
 * @return the length of the iban for the specified country.
 */
export function getIbanLength(countryCode: CountryCode): number {
  const structure = getBbanStructure(countryCode);

  if (structure === null) {
    throw new UnsupportedCountryException("Unsuppored country", countryCode);
  }

  return COUNTRY_CODE_LENGTH + CHECK_DIGIT_LENGTH + structure.getBbanLength();
}

/**
 * Returns iban's check digit.
 *
 * @param iban String
 * @return checkDigit String
 */
export function getCheckDigit(iban: string): string {
  return iban.substring(
    CHECK_DIGIT_INDEX,
    CHECK_DIGIT_INDEX + CHECK_DIGIT_LENGTH,
  );
}

/**
 * Returns iban's country code.
 *
 * @param iban String
 * @return countryCode String
 */
export function getCountryCode(iban: string): string {
  return iban.substring(
    COUNTRY_CODE_INDEX,
    COUNTRY_CODE_INDEX + COUNTRY_CODE_LENGTH,
  );
}

/**
 * Returns iban's country code and check digit.
 *
 * @param iban String
 * @return countryCodeAndCheckDigit String
 */
export function getCountryCodeAndCheckDigit(iban: string): string {
  return iban.substring(
    COUNTRY_CODE_INDEX,
    COUNTRY_CODE_INDEX + COUNTRY_CODE_LENGTH + CHECK_DIGIT_LENGTH,
  );
}

/**
 * Returns iban's bban (Basic Bank Account Number).
 *
 * @param iban String
 * @return bban String
 */
export function getBban(iban: string): string {
  return iban.substring(BBAN_INDEX);
}

/**
 * Returns iban's account number.
 *
 * @param iban String
 * @return accountNumber String
 */
export function getAccountNumber(iban: string): string | null {
  return extractBbanEntry(iban, PartType.ACCOUNT_NUMBER);
}

/**
 * Returns iban's bank code.
 *
 * @param iban String
 * @return bankCode String
 */
export function getBankCode(iban: string): string | null {
  return extractBbanEntry(iban, PartType.BANK_CODE);
}

/**
 * Returns iban's branch code.
 *
 * @param iban String
 * @return branchCode String
 */
export function getBranchCode(iban: string): string | null {
  return extractBbanEntry(iban, PartType.BRANCH_CODE);
}

/**
 * Returns iban's national check digit.
 *
 * @param iban String
 * @return nationalCheckDigit String
 */
export function getNationalCheckDigit(iban: string): string | null {
  return extractBbanEntry(iban, PartType.NATIONAL_CHECK_DIGIT);
}

/**
 * Returns iban's account type.
 *
 * @param iban String
 * @return accountType String
 */
export function getAccountType(iban: string): string | null {
  return extractBbanEntry(iban, PartType.ACCOUNT_TYPE);
}

/**
 * Returns iban's owner account type.
 *
 * @param iban String
 * @return ownerAccountType String
 */
export function getOwnerAccountType(iban: string): string | null {
  return extractBbanEntry(iban, PartType.OWNER_ACCOUNT_NUMBER);
}

/**
 * Returns iban's identification number.
 *
 * @param iban String
 * @return identificationNumber String
 */
export function getIdentificationNumber(iban: string): string | null {
  return extractBbanEntry(iban, PartType.IDENTIFICATION_NUMBER);
}

/*
function calculateCheckDigitIban(iban: Iban): string {
  return calculateCheckDigit(iban.toString());
}
*/

/**
 * Returns an iban with replaced check digit.
 *
 * @param iban The iban
 * @return The iban without the check digit
 */
export function replaceCheckDigit(iban: string, checkDigit: string): string {
  return getCountryCode(iban) + checkDigit + getBban(iban);
}

/**
 * Returns formatted version of Iban.
 *
 * @return A string representing formatted Iban for printing.
 */
export function toFormattedString(iban: string): string {
  return iban.replace(/(.{4})/g, "$1 ").trim();
}

export function validateCheckDigit(iban: string) {
  if (calculateMod(iban) != 1) {
    const checkDigit = getCheckDigit(iban);
    const expectedCheckDigit = calculateCheckDigit(iban);

    throw new InvalidCheckDigitException(
      `[${iban}] has invalid check digit: ${checkDigit}, expected check digit is: ${expectedCheckDigit}`,
      checkDigit,
      expectedCheckDigit,
    );
  }
}

function validateEmpty(iban: string) {
  if (iban == null) {
    throw new IbanFormatException(
      FormatViolation.NOT_NULL,
      "Null can't be a valid Iban.",
    );
  }

  if (iban.length === 0) {
    throw new IbanFormatException(
      FormatViolation.NOT_EMPTY,
      "Empty string can't be a valid Iban.",
    );
  }
}

function validateCountryCode(iban: string) {
  // check if iban contains 2 char country code
  if (iban.length < COUNTRY_CODE_LENGTH) {
    throw new IbanFormatException(
      FormatViolation.COUNTRY_CODE_TWO_LETTERS,
      "Iban must contain 2 char country code.",
      iban,
    );
  }

  const countryCode = getCountryCode(iban);

  // check case sensitivity
  if (countryCode !== countryCode.toUpperCase() || !ucRegex.test(countryCode)) {
    throw new IbanFormatException(
      FormatViolation.COUNTRY_CODE_ONLY_UPPER_CASE_LETTERS,
      "Iban country code must contain upper case letters.",
      countryCode,
    );
  }

  const country = countryByCode(countryCode);
  if (country == null) {
    throw new IbanFormatException(
      FormatViolation.COUNTRY_CODE_EXISTS,
      "Iban contains non existing country code.",
      countryCode,
    );
  }

  // check if country is supported
  const structure = BbanStructure.forCountry(country);
  if (structure == null) {
    throw new UnsupportedCountryException(
      "Country code is not supported.",
      countryCode,
    );
  }
}

function validateCheckDigitPresence(iban: string) {
  // check if iban contains 2 digit check digit
  if (iban.length < COUNTRY_CODE_LENGTH + CHECK_DIGIT_LENGTH) {
    throw new IbanFormatException(
      FormatViolation.CHECK_DIGIT_TWO_DIGITS,
      "Iban must contain 2 digit check digit.",
      iban.substring(COUNTRY_CODE_LENGTH),
    );
  }

  const checkDigit = getCheckDigit(iban);

  // check digits
  if (!numRegex.test(checkDigit)) {
    throw new IbanFormatException(
      FormatViolation.CHECK_DIGIT_ONLY_DIGITS,
      "Iban's check digit should contain only digits.",
      checkDigit,
    );
  }
}

function validateBbanLength(iban: string, structure: BbanStructure) {
  const expectedBbanLength = structure.getBbanLength();
  const bban = getBban(iban);
  const bbanLength = bban.length;

  if (expectedBbanLength != bbanLength) {
    throw new IbanFormatException(
      FormatViolation.BBAN_LENGTH,
      `[${bban}] length is ${bbanLength}, expected BBAN length is: ${expectedBbanLength}`,
      String(bbanLength),
      String(expectedBbanLength),
    );
  }
}

function validateBbanEntries(iban: string, structure: BbanStructure) {
  const bban = getBban(iban);

  let offset = 0;

  for (let part of structure.getParts()) {
    const partLength = part.getLength();
    const entryValue = bban.substring(offset, offset + partLength);

    offset = offset + partLength;

    // validate character type
    validateBbanEntryCharacterType(part, entryValue);
  }
}

function validateBbanEntryCharacterType(
  part: BbanStructurePart,
  entryValue: string,
) {
  if (part.validate(entryValue)) {
    return;
  }

  switch (part.getCharacterType()) {
    case CharacterType.a:
      throw new IbanFormatException(
        FormatViolation.BBAN_ONLY_UPPER_CASE_LETTERS,
        `[${entryValue}] must contain only upper case letters.`,
        entryValue,
      );
    case CharacterType.c:
      throw new IbanFormatException(
        FormatViolation.BBAN_ONLY_DIGITS_OR_LETTERS,
        `[${entryValue}] must contain only digits or letters.`,
        entryValue,
      );
    case CharacterType.n:
      throw new IbanFormatException(
        FormatViolation.BBAN_ONLY_DIGITS,
        `[${entryValue}] must contain only digits.`,
        entryValue,
      );
  }
}

/**
 * Calculates
 * <a href="http://en.wikipedia.org/wiki/ISO_13616#Modulo_operation_on_IBAN">Iban Modulo</a>.
 *
 * @param iban String value
 * @return modulo 97
 */
function calculateMod(iban: string): number {
  const reformattedIban = getBban(iban) + getCountryCodeAndCheckDigit(iban);

  /*
            function iso13616Prepare(iban) {
        iban = iban.toUpperCase();
        iban = iban.substr(4) + iban.substr(0,4);

        return iban.split('').map(function(n){
            var code = n.charCodeAt(0);
            if (code >= A && code <= Z){
                // A = 10, B = 11, ... Z = 35
                return code - A + 10;
            } else {
                return n;
            }
        }).join('');
    }*/

  const VA = "A".charCodeAt(0);
  const VZ = "Z".charCodeAt(0);
  const V0 = "0".charCodeAt(0);
  const V9 = "9".charCodeAt(0);

  function addSum(total: number, value: number) {
    const newTotal = (value > 9 ? total * 100 : total * 10) + value;

    return newTotal > MAX ? newTotal % MOD : newTotal;
  }

  const total = reformattedIban
    .toUpperCase()
    .split("")
    .reduce((total, ch) => {
      const code = ch.charCodeAt(0);

      if (VA <= code && code <= VZ) {
        return addSum(total, code - VA + 10);
      } else if (V0 <= code && code <= V9) {
        return addSum(total, code - V0);
      } else {
        throw new IbanFormatException(
          FormatViolation.IBAN_VALID_CHARACTERS,
          `Invalid Character[${ch}] = '${code}'`,
          ch,
        );
      }
    }, 0);

  return total % MOD;
}

function getBbanStructure(iban: string): BbanStructure | null {
  const countryCode = countryByCode(getCountryCode(iban));

  if (!countryCode) {
    return null;
  }

  return getBbanStructureByCountry(countryCode);
}

function getBbanStructureByCountry(
  countryCode: CountryCode,
): BbanStructure | null {
  return BbanStructure.forCountry(countryCode);
}

function extractBbanEntry(iban: string, partType: PartType): string | null {
  const bban = getBban(iban);
  const structure = getBbanStructure(iban);

  if (structure === null) {
    return null;
  }

  let bbanPartOffset = 0;
  let result = null;

  for (let part of structure.getParts()) {
    const partLength = part.getLength();
    const partValue = bban.substring(
      bbanPartOffset,
      bbanPartOffset + partLength,
    );

    bbanPartOffset = bbanPartOffset + partLength;
    if (part.getPartType() == partType) {
      result = (result || "") + partValue;
    }
  }

  return result;
}

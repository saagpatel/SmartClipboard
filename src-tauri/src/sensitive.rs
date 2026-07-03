use regex::Regex;
use std::sync::LazyLock;

static SSN_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\b\d{3}-\d{2}-\d{4}\b|\b\d{9}\b").unwrap()
});

static PHONE_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\b\d{3}-\d{3}-\d{4}\b|\(\d{3}\)\s*\d{3}-\d{4}").unwrap()
});

/// Check if a string is a valid credit card using Luhn algorithm
pub fn is_credit_card(content: &str) -> bool {
    // Extract all digit sequences of 13-19 digits
    let digits: Vec<char> = content.chars().filter(|c| c.is_ascii_digit()).collect();

    if digits.len() < 13 || digits.len() > 19 {
        return false;
    }

    // Luhn algorithm
    let mut sum = 0;
    let mut double = false;

    for &digit in digits.iter().rev() {
        let mut n = digit.to_digit(10).unwrap();

        if double {
            n *= 2;
            if n > 9 {
                n -= 9;
            }
        }

        sum += n;
        double = !double;
    }

    sum % 10 == 0
}

/// Check if content contains SSN pattern
pub fn is_ssn(content: &str) -> bool {
    SSN_REGEX.is_match(content)
}

/// Check if content contains phone number pattern
pub fn is_phone(content: &str) -> bool {
    PHONE_REGEX.is_match(content)
}

/// Check if content is sensitive (credit card, SSN, or phone)
pub fn is_sensitive(content: &str) -> bool {
    is_credit_card(content) || is_ssn(content) || is_phone(content)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_credit_cards() {
        assert!(is_credit_card("4532015112830366")); // Valid Visa
        assert!(is_credit_card("5425233430109903")); // Valid Mastercard
        assert!(is_credit_card("374245455400126"));  // Valid Amex
    }

    #[test]
    fn test_invalid_credit_cards() {
        assert!(!is_credit_card("1234567890123456")); // Invalid checksum
        assert!(!is_credit_card("1234"));              // Too short
        assert!(!is_credit_card("12345678901234567890")); // Too long
    }

    #[test]
    fn test_ssn_detection() {
        assert!(is_ssn("123-45-6789"));
        assert!(is_ssn("123456789"));
        assert!(!is_ssn("12-34-567890")); // Wrong format
    }

    #[test]
    fn test_phone_detection() {
        assert!(is_phone("555-123-4567"));
        assert!(is_phone("(555) 123-4567"));
        assert!(!is_phone("5551234")); // Too short
    }

    #[test]
    fn test_is_sensitive() {
        assert!(is_sensitive("4532015112830366")); // CC
        assert!(is_sensitive("SSN: 123-45-6789")); // SSN
        assert!(is_sensitive("Call me at 555-123-4567")); // Phone
        assert!(!is_sensitive("Just regular text"));
    }

    #[test]
    fn test_false_positives() {
        // User ID that looks like SSN but in different context
        assert!(is_ssn("123456789")); // This will match - acceptable for MVP safety
        // The detector is intentionally conservative (false positives OK)
    }
}

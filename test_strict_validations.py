import unittest
from pydantic import ValidationError
from backend.app.schemas.client import ClientCreate


class TestStrictValidations(unittest.TestCase):
    def test_name_with_numbers_rejected(self):
        with self.assertRaises(ValidationError) as ctx:
            ClientCreate(name="Ruwan123", email="ruwan@example.com")
        self.assertIn("Client name cannot contain numbers", str(ctx.exception))

    def test_name_with_digits_mixed_rejected(self):
        with self.assertRaises(ValidationError) as ctx:
            ClientCreate(name="Kasun 2 Perera", email="kasun@example.com")
        self.assertIn("Client name cannot contain numbers", str(ctx.exception))

    def test_name_valid_accepted(self):
        client = ClientCreate(name="Ruwan Perera", email="ruwan@example.com")
        self.assertEqual(client.name, "Ruwan Perera")

    def test_name_with_hyphen_and_apostrophe_accepted(self):
        client = ClientCreate(name="Jean-Luc O'Connor", email="jean@example.com")
        self.assertEqual(client.name, "Jean-Luc O'Connor")

    def test_phone_with_letters_rejected(self):
        with self.assertRaises(ValidationError) as ctx:
            ClientCreate(name="Ruwan Perera", email="ruwan@example.com", phone="077abc1234")
        self.assertIn("Phone number cannot contain letters", str(ctx.exception))

    def test_phone_too_short_rejected(self):
        with self.assertRaises(ValidationError) as ctx:
            ClientCreate(name="Ruwan Perera", email="ruwan@example.com", phone="12345")
        self.assertIn("Phone number must contain between 9 and 15 digits", str(ctx.exception))

    def test_phone_valid_accepted(self):
        client = ClientCreate(name="Ruwan Perera", email="ruwan@example.com", phone="+94 77 123 4567")
        self.assertEqual(client.phone, "+94 77 123 4567")

    def test_phone_none_accepted(self):
        client = ClientCreate(name="Ruwan Perera", email="ruwan@example.com", phone=None)
        self.assertIsNone(client.phone)

    def test_invalid_email_rejected(self):
        with self.assertRaises(ValidationError):
            ClientCreate(name="Ruwan Perera", email="not-an-email")


if __name__ == "__main__":
    unittest.main()

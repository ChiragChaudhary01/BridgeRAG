import sys
from pathlib import Path
import unittest

sys.path.append(str(Path(__file__).resolve().parents[1]))

from vectorstore.chroma_store import VectorStoreManager


class VectorStoreFallbackTests(unittest.TestCase):
    def test_fallback_embedding_returns_fixed_length_vector(self):
        manager = VectorStoreManager.__new__(VectorStoreManager)
        vector = manager._create_fallback_embedding("hello world")

        self.assertIsInstance(vector, list)
        self.assertEqual(len(vector), 3072)
        self.assertTrue(any(value != 0.0 for value in vector))


if __name__ == "__main__":
    unittest.main()

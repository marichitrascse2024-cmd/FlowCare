import os
import json
import base64
from typing import Dict, Any, Tuple
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import hashes, serialization
from app.core.config import settings

class HybridEncryptionService:
    def __init__(self):
        self._private_key = None
        self._public_key = None
        self._init_rsa_keys()

    def _init_rsa_keys(self):
        """Initialize or generate backend RSA-2048 keypair for AES key encapsulation."""
        key_dir = os.path.join(os.path.dirname(__file__), "..", "core", "keys")
        os.makedirs(key_dir, exist_ok=True)
        priv_path = os.path.join(key_dir, "rsa_private_key.pem")
        pub_path = os.path.join(key_dir, "rsa_public_key.pem")

        if os.path.exists(priv_path) and os.path.exists(pub_path):
            with open(priv_path, "rb") as f:
                self._private_key = serialization.load_pem_private_key(f.read(), password=None)
            with open(pub_path, "rb") as f:
                self._public_key = serialization.load_pem_public_key(f.read())
        else:
            self._private_key = rsa.generate_private_key(
                public_exponent=65537,
                key_size=2048
            )
            self._public_key = self._private_key.public_key()

            with open(priv_path, "wb") as f:
                f.write(self._private_key.private_bytes(
                    encoding=serialization.Encoding.PEM,
                    format=serialization.PrivateFormat.PKCS8,
                    encryption_algorithm=serialization.NoEncryption()
                ))
            with open(pub_path, "wb") as f:
                f.write(self._public_key.public_bytes(
                    encoding=serialization.Encoding.PEM,
                    format=serialization.PublicFormat.SubjectPublicKeyInfo
                ))

    def encrypt_medical_payload(self, sensitive_data: Dict[str, Any]) -> Dict[str, str]:
        """
        HYBRID ENCRYPTION FLOW:
        1. Generate a random AES-256 session key.
        2. Encrypt sensitive patient data with AES-256-GCM.
        3. Encrypt the AES session key using backend RSA-2048 public key (OAEP with SHA-256).
        4. Return base64 encoded ciphertext, wrapped key, and IV/nonce.
        """
        # Step 1: Generate random AES-256 session key
        aes_session_key = AESGCM.generate_key(bit_length=256)
        aesgcm = AESGCM(aes_session_key)

        # Step 2: Encrypt JSON payload with 96-bit random IV
        nonce = os.urandom(12)
        plaintext_bytes = json.dumps(sensitive_data).encode("utf-8")
        ciphertext = aesgcm.encrypt(nonce, plaintext_bytes, None)

        # Step 3: Wrap AES session key with RSA-2048 Public Key
        encrypted_aes_key = self._public_key.encrypt(
            aes_session_key,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None
            )
        )

        return {
            "is_encrypted": True,
            "encrypted_payload": base64.b64encode(ciphertext).decode("utf-8"),
            "encryption_key": base64.b64encode(encrypted_aes_key).decode("utf-8"),
            "encryption_iv": base64.b64encode(nonce).decode("utf-8"),
            "encryption_tag": "AES-256-GCM+RSA-2048-OAEP"
        }

    def decrypt_medical_payload(self, encrypted_payload_b64: str, wrapped_key_b64: str, iv_b64: str) -> Dict[str, Any]:
        """
        HYBRID DECRYPTION FLOW:
        1. Decrypt wrapped AES key using backend RSA Private Key.
        2. Decrypt medical ciphertext using decrypted AES key and IV.
        3. Parse JSON and return decrypted fields.
        """
        try:
            wrapped_aes_key = base64.b64decode(wrapped_key_b64.encode("utf-8"))
            ciphertext = base64.b64decode(encrypted_payload_b64.encode("utf-8"))
            nonce = base64.b64decode(iv_b64.encode("utf-8"))

            # Step 1: Decrypt AES Session Key with RSA Private Key
            aes_session_key = self._private_key.decrypt(
                wrapped_aes_key,
                padding.OAEP(
                    mgf=padding.MGF1(algorithm=hashes.SHA256()),
                    algorithm=hashes.SHA256(),
                    label=None
                )
            )

            # Step 2: Decrypt Ciphertext with AES-GCM
            aesgcm = AESGCM(aes_session_key)
            decrypted_bytes = aesgcm.decrypt(nonce, ciphertext, None)
            return json.loads(decrypted_bytes.decode("utf-8"))
        except Exception as e:
            return {"error": f"Decryption failed: {str(e)}"}

encryption_service = HybridEncryptionService()

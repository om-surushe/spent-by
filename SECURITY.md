# Security Policy

Finance Vault handles sensitive financial information and is still a prototype. Do not use it as your only backup, and do not post real financial data, recovery phrases, credentials, or vulnerability details in public issues.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting for this repository. Include the affected version, reproduction steps, impact, and any suggested mitigation. Please allow time for a fix before public disclosure.

## Current boundaries

- Transaction content is encrypted in the browser with AES-256-GCM.
- The cloud stores ciphertext plus synchronization metadata.
- Recovery phrases are never intentionally sent to the backend.
- This design has not received an independent security audit.

#!/usr/bin/env python3
"""Valida uma solicitação emitida pelo proprietário da conta GitHub."""
import json
import os
import pathlib
import re
import sys

def fail(message):
    print(f"Solicitação inválida: {message}", file=sys.stderr)
    sys.exit(1)

raw = os.getenv("FACTORY_REQUEST", "")
if len(raw) > 6000:
    fail("o corpo precisa ter no máximo 6000 caracteres")
try:
    data = json.loads(raw)
except json.JSONDecodeError:
    fail("o corpo da issue deve conter somente um objeto JSON válido")
if not isinstance(data, dict):
    fail("o conteúdo deve ser um objeto JSON")
if set(data) - {"operation", "name", "description", "private", "output_dir"}:
    fail("contém campos desconhecidos")
operation = data.get("operation")
if operation not in {"create", "deploy"}:
    fail("operation deve ser create ou deploy")
name = data.get("name")
if not isinstance(name, str) or not re.fullmatch(r"[a-z][a-z0-9-]{1,38}[a-z0-9]", name):
    fail("name deve ser um identificador minúsculo com 3 a 40 caracteres")
private = data.get("private", True)
if type(private) is not bool:
    fail("private deve ser true ou false")
description = data.get("description", "Projeto GestarLink")
if not isinstance(description, str) or len(description) > 160:
    fail("description deve ter no máximo 160 caracteres")
output_dir = data.get("output_dir")
if output_dir is not None:
    if not isinstance(output_dir, str) or not re.fullmatch(r"[A-Za-z0-9_-]+(?:/[A-Za-z0-9_-]+)*", output_dir):
        fail("output_dir deve ser uma pasta relativa, sem '..' nem caminhos absolutos")

clean = {
    "operation": operation,
    "name": name,
    "description": description,
    "private": private,
    "output_dir": output_dir,
}
root = pathlib.Path(os.environ["GITHUB_WORKSPACE"])
(root / ".factory-request.json").write_text(json.dumps(clean), encoding="utf-8")
with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as f:
    f.write(f"operation={operation}\n")
    f.write(f"name={name}\n")
print(f"Solicitação validada: {operation} {name}")

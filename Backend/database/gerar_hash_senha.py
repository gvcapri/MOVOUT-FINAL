"""
Gera um hash bcrypt para a senha "123456".
Use o resultado para atualizar o seed.sql ou a tabela pessoa7 se o login falhar.

Uso (na pasta Backend, com venv ativado):
  pip install bcrypt
  python database/gerar_hash_senha.py
"""
try:
    import bcrypt
except ImportError:
    print("Instale bcrypt: pip install bcrypt")
    exit(1)

senha = b"123456"
hash_ = bcrypt.hashpw(senha, bcrypt.gensalt(rounds=12))
print("Hash bcrypt para senha '123456':")
print(hash_.decode())
print("\nAtualize o INSERT em seed.sql com esse hash ou execute:")
print("  UPDATE pessoa7 SET senha_hash = '<hash acima>' WHERE email = 'fabricio@ufmt.br';")

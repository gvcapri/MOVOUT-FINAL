"""
Configuração de conexão com o banco de dados MySQL usando SQLModel.
Mantém compatibilidade com código legado que usa SQLAlchemy diretamente.
"""
from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy import text # Mantendo para compatibilidade se necessário
from sqlalchemy.orm import sessionmaker
from app.core.config import (
    DB_HOST,
    DB_NAME,
    DB_PASSWORD,
    DB_PORT,
    DB_USER,
    DATABASE_URL_ENV,
)

# String de conexão MySQL
if DATABASE_URL_ENV:
    # Garante que use o driver pymysql se não estiver especificado
    if DATABASE_URL_ENV.startswith("mysql://"):
        DATABASE_URL = DATABASE_URL_ENV.replace("mysql://", "mysql+pymysql://", 1)
    else:
        DATABASE_URL = DATABASE_URL_ENV
else:
    DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"

# Cria o engine do SQLAlchemy (SQLModel é wrapper do SQLAlchemy)
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=280,
    pool_size=5,
    max_overflow=10,
    echo=False
)

# Alias para SessionLocal se for necessário em código legacy
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_session():
    """
    Dependency para obter sessão do banco de dados (SQLModel).
    """
    with Session(engine) as session:
        yield session

# Alias para compatibilidade com código que importa get_db
get_db = get_session

def create_db_and_tables():
    """
    Cria as tabelas definidas nos modelos SQLModel.
    """
    # Importar modelos para registrar no SQLModel.metadata
    from app.models.models import Motorista, PedidoFrete, PropostaFrete, MensagemChat
    SQLModel.metadata.create_all(engine)
    _ensure_pedidofrete_columns()
    _ensure_movout_aux_tables()


def _ensure_pedidofrete_columns():
    """
    Ajusta schema legado sem migracao formal.
    """
    base_statements = [
        "ALTER TABLE pedidofrete MODIFY COLUMN origem VARCHAR(255) NULL",
        "ALTER TABLE pedidofrete MODIFY COLUMN destino VARCHAR(255) NULL",
    ]
    maybe_columns = {
        "origem_lat": "ALTER TABLE pedidofrete ADD COLUMN origem_lat DOUBLE NULL",
        "origem_lng": "ALTER TABLE pedidofrete ADD COLUMN origem_lng DOUBLE NULL",
        "destino_lat": "ALTER TABLE pedidofrete ADD COLUMN destino_lat DOUBLE NULL",
        "destino_lng": "ALTER TABLE pedidofrete ADD COLUMN destino_lng DOUBLE NULL",
        "distancia_km": "ALTER TABLE pedidofrete ADD COLUMN distancia_km DOUBLE NULL",
    }
    try:
        with engine.begin() as conn:
            for stmt in base_statements:
                conn.execute(text(stmt))
            existing = conn.execute(
                text(
                    "SELECT COLUMN_NAME FROM information_schema.COLUMNS "
                    "WHERE TABLE_SCHEMA = :db_name AND TABLE_NAME = 'pedidofrete'"
                ),
                {"db_name": DB_NAME},
            ).fetchall()
            existing_names = {row[0] for row in existing}
            for col_name, stmt in maybe_columns.items():
                if col_name not in existing_names:
                    conn.execute(text(stmt))
    except Exception as e:
        print(f"Aviso ao ajustar schema pedidofrete: {e}")

def test_connection():
    """
    Testa a conexão com o banco de dados.
    """
    try:
        with Session(engine) as session:
            session.exec(text("SELECT 1"))
            return True
    except Exception as e:
        print(f"Erro ao conectar ao banco de dados: {e}")
        return False


def _ensure_movout_aux_tables():
    """Cria/ajusta tabelas auxiliares da versão local completa.
    Mantém o backend funcional tanto no TiDB quanto em MySQL local.
    """
    statements = [
        """
        CREATE TABLE IF NOT EXISTS cartao_cliente7 (
            id_cartao BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            id_cliente BIGINT UNSIGNED NOT NULL,
            apelido VARCHAR(80) NULL,
            titular VARCHAR(120) NULL,
            bandeira VARCHAR(30) NULL,
            ultimos4 CHAR(4) NOT NULL,
            mes_expiracao TINYINT NULL,
            ano_expiracao SMALLINT NULL,
            token_pagamento VARCHAR(255) NULL,
            principal TINYINT DEFAULT 0,
            ativo TINYINT DEFAULT 1,
            criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_cartao_cliente7_cliente (id_cliente),
            INDEX idx_cartao_cliente7_principal (id_cliente, principal)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
        """
        CREATE TABLE IF NOT EXISTS tarifa_veiculo7 (
            tipo_veiculo VARCHAR(20) NOT NULL PRIMARY KEY,
            descricao VARCHAR(80) NOT NULL,
            valor_base DECIMAL(10,2) NOT NULL DEFAULT 0,
            valor_por_km DECIMAL(10,2) NOT NULL DEFAULT 0,
            valor_por_kg DECIMAL(10,2) NOT NULL DEFAULT 0,
            multiplicador DECIMAL(10,2) NOT NULL DEFAULT 1,
            ativo TINYINT DEFAULT 1,
            atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
        """
        CREATE TABLE IF NOT EXISTS tarifa_prioridade7 (
            prioridade VARCHAR(20) NOT NULL PRIMARY KEY,
            descricao VARCHAR(80) NOT NULL,
            multiplicador DECIMAL(10,2) NOT NULL DEFAULT 1,
            taxa_fixa DECIMAL(10,2) NOT NULL DEFAULT 0,
            ativo TINYINT DEFAULT 1,
            atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
        """
        CREATE TABLE IF NOT EXISTS avaliacao_frete7 (
            id_avaliacao BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            id_frete BIGINT UNSIGNED NOT NULL,
            tipo_avaliador VARCHAR(20) NOT NULL,
            id_avaliador_pessoa BIGINT UNSIGNED NOT NULL,
            id_avaliado_pessoa BIGINT UNSIGNED NOT NULL,
            nota TINYINT NOT NULL,
            comentario TEXT NULL,
            criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uk_avaliacao_frete_tipo (id_frete, tipo_avaliador),
            INDEX idx_avaliacao_frete7_frete (id_frete),
            INDEX idx_avaliacao_frete7_avaliado (id_avaliado_pessoa)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
        """
        CREATE TABLE IF NOT EXISTS pagamento_frete7 (
            id_pagamento BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            id_frete BIGINT UNSIGNED NOT NULL,
            id_cliente BIGINT UNSIGNED NULL,
            id_motorista BIGINT UNSIGNED NULL,
            valor DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            status VARCHAR(40) NOT NULL DEFAULT 'AGUARDANDO_LIBERACAO',
            criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            liberado_em TIMESTAMP NULL DEFAULT NULL,
            confirmado_em TIMESTAMP NULL DEFAULT NULL,
            observacao TEXT NULL,
            UNIQUE KEY uq_pagamento_frete7_frete (id_frete)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
        """
        CREATE TABLE IF NOT EXISTS carteira_motorista7 (
            id_motorista BIGINT UNSIGNED NOT NULL PRIMARY KEY,
            saldo_disponivel DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            saldo_pendente DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
        """
        CREATE TABLE IF NOT EXISTS avaliacao7 (
            id_avaliacao BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            id_frete BIGINT UNSIGNED NOT NULL,
            id_avaliador_pessoa BIGINT UNSIGNED NULL,
            tipo_avaliador VARCHAR(20) NOT NULL,
            id_avaliado_pessoa BIGINT UNSIGNED NULL,
            tipo_avaliado VARCHAR(20) NOT NULL,
            nota INT NOT NULL,
            comentario TEXT NULL,
            criada_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_avaliacao7_frete (id_frete)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    ]
    try:
        with engine.begin() as conn:
            for stmt in statements:
                conn.execute(text(stmt))
            seed_stmts = [
                """
                INSERT INTO tarifa_veiculo7 (tipo_veiculo, descricao, valor_base, valor_por_km, valor_por_kg, multiplicador, ativo)
                VALUES ('CARRO','Carro',12.00,2.20,0.10,1.00,1), ('VAN','Van',20.00,3.20,0.16,1.35,1), ('CAMINHAO','Caminhão',35.00,5.00,0.24,1.85,1)
                ON DUPLICATE KEY UPDATE descricao=VALUES(descricao), valor_base=VALUES(valor_base), valor_por_km=VALUES(valor_por_km), valor_por_kg=VALUES(valor_por_kg), multiplicador=VALUES(multiplicador), ativo=VALUES(ativo)
                """,
                """
                INSERT INTO tarifa_prioridade7 (prioridade, descricao, multiplicador, taxa_fixa, ativo)
                VALUES ('20_MINUTOS','Em até 20 minutos',1.35,10.00,1), ('HOJE','Ainda hoje',1.15,5.00,1), ('AGENDADO','Agendado',1.00,0.00,1)
                ON DUPLICATE KEY UPDATE descricao=VALUES(descricao), multiplicador=VALUES(multiplicador), taxa_fixa=VALUES(taxa_fixa), ativo=VALUES(ativo)
                """,
            ]
            for stmt in seed_stmts:
                conn.execute(text(stmt))
            for table, columns in {
                'motorista7': {
                    'numero_cnh': 'VARCHAR(20) NULL', 'categoria_cnh': 'VARCHAR(5) NULL', 'validade_cnh': 'DATE NULL', 'uf_cnh': 'VARCHAR(2) NULL', 'cnh_verificada': 'TINYINT DEFAULT 0', 'situacao_cnh': "VARCHAR(30) DEFAULT 'PENDENTE'",
                },
                'carteira_motorista7': {
                    'numero_cnh': 'VARCHAR(20) NULL', 'categoria_cnh': 'VARCHAR(5) NULL', 'validade_cnh': 'DATE NULL', 'uf_cnh': 'VARCHAR(2) NULL', 'cnh_verificada': 'TINYINT DEFAULT 0', 'situacao_cnh': "VARCHAR(30) DEFAULT 'PENDENTE'",
                },
                'frete7': {
                    'id_cartao_cliente': 'BIGINT UNSIGNED NULL', 'metodo_pagamento': 'VARCHAR(40) NULL', 'pagamento_descricao': 'VARCHAR(120) NULL', 'prioridade_entrega': "VARCHAR(20) DEFAULT 'HOJE'", 'data_agendada': 'DATETIME NULL', 'tipo_veiculo_solicitado': "VARCHAR(20) DEFAULT 'CARRO'", 'peso_estimado_kg': 'DECIMAL(10,2) DEFAULT 0', 'valor_base': 'DECIMAL(10,2) DEFAULT 0', 'valor_distancia': 'DECIMAL(10,2) DEFAULT 0', 'valor_peso': 'DECIMAL(10,2) DEFAULT 0', 'valor_veiculo': 'DECIMAL(10,2) DEFAULT 0', 'valor_prioridade': 'DECIMAL(10,2) DEFAULT 0', 'valor_total_calculado': 'DECIMAL(10,2) DEFAULT 0', 'cliente_confirmou_conclusao': 'TINYINT DEFAULT 0', 'motorista_confirmou_conclusao': 'TINYINT DEFAULT 0', 'concluido_em': 'DATETIME NULL',
                },
                'pedidofrete': {
                    'id_cartao_cliente': 'BIGINT UNSIGNED NULL', 'metodo_pagamento': 'VARCHAR(40) NULL', 'pagamento_descricao': 'VARCHAR(120) NULL', 'prioridade_entrega': "VARCHAR(20) DEFAULT 'HOJE'", 'data_agendada': 'DATETIME NULL', 'tipo_veiculo_solicitado': "VARCHAR(20) DEFAULT 'CARRO'", 'peso_estimado_kg': 'DECIMAL(10,2) DEFAULT 0', 'valor_total_calculado': 'DECIMAL(10,2) DEFAULT 0',
                },
            }.items():
                existing = conn.execute(text("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table"), {'table': table}).fetchall()
                names = {row[0] for row in existing}
                for col, definition in columns.items():
                    if col not in names:
                        try:
                            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {definition}"))
                        except Exception as e:
                            print(f"Aviso ao adicionar {table}.{col}: {e}")
            try:
                conn.execute(text("DROP VIEW IF EXISTS vw_cliente_perfil7"))
                conn.execute(text("""
                    CREATE VIEW vw_cliente_perfil7 AS
                    SELECT c.id_cliente, p.id_pessoa, p.nome, p.email,
                           COUNT(CASE WHEN LOWER(f.status) IN ('concluido','concluído','finalizado') THEN 1 END) AS fretes_concluidos,
                           COALESCE(ROUND(AVG(CASE WHEN a.tipo_avaliador = 'MOTORISTA' THEN a.nota END), 2), 0) AS avaliacao_media_cliente
                    FROM cliente7 c
                    JOIN pessoa7 p ON p.id_pessoa = c.id_pessoa
                    LEFT JOIN frete7 f ON f.id_cliente = c.id_cliente
                    LEFT JOIN avaliacao_frete7 a ON a.id_frete = f.id_frete AND a.id_avaliado_pessoa = p.id_pessoa AND a.tipo_avaliador = 'MOTORISTA'
                    GROUP BY c.id_cliente, p.id_pessoa, p.nome, p.email
                """))
            except Exception as e:
                print(f"Aviso ao criar view vw_cliente_perfil7: {e}")
    except Exception as e:
        print(f"Aviso ao criar tabelas auxiliares Movout: {e}")

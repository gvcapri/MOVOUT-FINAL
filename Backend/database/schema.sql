-- =====================================================
-- MOVOUT - Script de Criação do Banco de Dados MySQL
-- Sistema de Gestão de Fretes (Cliente-Freteiro)
-- =====================================================

-- Criação do banco de dados
CREATE DATABASE IF NOT EXISTS movout_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE movout_db;

-- =====================================================
-- TABELA: pessoa7
-- Armazena informações básicas de todas as pessoas
-- (clientes e motoristas)
-- =====================================================
CREATE TABLE IF NOT EXISTS pessoa7 (
    id_pessoa INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    cpf VARCHAR(14) UNIQUE NOT NULL COMMENT 'CPF formatado (000.000.000-00)',
    email VARCHAR(255) UNIQUE NOT NULL,
    telefone VARCHAR(20) NOT NULL,
    senha_hash VARCHAR(255) NOT NULL COMMENT 'Hash da senha (bcrypt)',
    sexo ENUM('M', 'F', 'O', 'N') DEFAULT 'N' COMMENT 'M=Masculino, F=Feminino, O=Outro, N=Não informado',
    idade INT CHECK (idade >= 0 AND idade <= 150),
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_cpf (cpf)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: cliente7
-- Armazena informações específicas de clientes
-- Relacionamento 1:1 com pessoa7
-- =====================================================
CREATE TABLE IF NOT EXISTS cliente7 (
    id_cliente INT AUTO_INCREMENT PRIMARY KEY,
    id_pessoa INT UNIQUE NOT NULL,
    tipo_cliente VARCHAR(50) DEFAULT 'PESSOA_FISICA' COMMENT 'PESSOA_FISICA, PESSOA_JURIDICA',
    observacoes TEXT,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_pessoa) REFERENCES pessoa7(id_pessoa) ON DELETE CASCADE,
    INDEX idx_id_pessoa (id_pessoa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: motorista7
-- Armazena informações específicas de motoristas
-- Relacionamento 1:1 com pessoa7
-- =====================================================
CREATE TABLE IF NOT EXISTS motorista7 (
    id_motorista INT AUTO_INCREMENT PRIMARY KEY,
    id_pessoa INT UNIQUE NOT NULL,
    avaliacao_media DECIMAL(3,2) DEFAULT 0.00 CHECK (avaliacao_media >= 0.00 AND avaliacao_media <= 5.00),
    data_inicio DATE,
    cnh VARCHAR(20) UNIQUE COMMENT 'Número da CNH',
    status ENUM('ATIVO', 'INATIVO', 'SUSPENSO') DEFAULT 'ATIVO',
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_pessoa) REFERENCES pessoa7(id_pessoa) ON DELETE CASCADE,
    INDEX idx_id_pessoa (id_pessoa),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: veiculo7
-- Armazena informações dos veículos dos motoristas
-- =====================================================
CREATE TABLE IF NOT EXISTS veiculo7 (
    id_veiculo INT AUTO_INCREMENT PRIMARY KEY,
    id_motorista INT NOT NULL,
    tipo VARCHAR(50) NOT NULL COMMENT 'Ex: Caminhão, Van, Carreta, etc.',
    carga_max_kg DECIMAL(10,2) NOT NULL CHECK (carga_max_kg > 0),
    volume_max_carga DECIMAL(10,2) NOT NULL COMMENT 'Volume máximo em m³' CHECK (volume_max_carga > 0),
    marca VARCHAR(100),
    modelo VARCHAR(100),
    placa VARCHAR(10) UNIQUE NOT NULL,
    ano INT,
    cor VARCHAR(50),
    status ENUM('DISPONIVEL', 'EM_USO', 'MANUTENCAO', 'INATIVO') DEFAULT 'DISPONIVEL',
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_motorista) REFERENCES motorista7(id_motorista) ON DELETE CASCADE,
    INDEX idx_id_motorista (id_motorista),
    INDEX idx_placa (placa),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: item_modelo7
-- Armazena modelos/catálogo de itens que podem ser transportados
-- (usado para detecção YOLO e cálculo de preços)
-- =====================================================
CREATE TABLE IF NOT EXISTS item_modelo7 (
    id_item INT AUTO_INCREMENT PRIMARY KEY,
    id_yolo_classe INT COMMENT 'ID da classe no modelo YOLO',
    nome VARCHAR(255) NOT NULL,
    categoria VARCHAR(100) NOT NULL,
    peso_kg DECIMAL(10,2) NOT NULL CHECK (peso_kg > 0),
    largura_m DECIMAL(10,2) NOT NULL CHECK (largura_m > 0),
    altura_m DECIMAL(10,2) NOT NULL CHECK (altura_m > 0),
    profundidade_m DECIMAL(10,2) NOT NULL CHECK (profundidade_m > 0),
    volume_m3 DECIMAL(10,2) GENERATED ALWAYS AS (largura_m * altura_m * profundidade_m) STORED,
    preco_base DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Preço base para cálculo de frete',
    ativo BOOLEAN DEFAULT TRUE,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_categoria (categoria),
    INDEX idx_id_yolo_classe (id_yolo_classe),
    INDEX idx_ativo (ativo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: frete7
-- Armazena informações dos fretes solicitados
-- =====================================================
CREATE TABLE IF NOT EXISTS frete7 (
    id_frete INT AUTO_INCREMENT PRIMARY KEY,
    id_cliente INT NOT NULL,
    id_motorista INT NULL COMMENT 'NULL até ser aceito por um motorista',
    id_veiculo INT NULL COMMENT 'NULL até ser aceito por um motorista',
    localizacao_id INT COMMENT 'ID de localização geográfica (pode ser usado com PostGIS)',
    endereco_origem VARCHAR(500) NOT NULL,
    endereco_destino VARCHAR(500) NOT NULL,
    coordenada_origem_lat DECIMAL(10,8) COMMENT 'Latitude do endereço de origem',
    coordenada_origem_lng DECIMAL(11,8) COMMENT 'Longitude do endereço de origem',
    coordenada_destino_lat DECIMAL(10,8) COMMENT 'Latitude do endereço de destino',
    coordenada_destino_lng DECIMAL(11,8) COMMENT 'Longitude do endereço de destino',
    distancia_km DECIMAL(10,2) NOT NULL CHECK (distancia_km >= 0),
    peso_total_kg DECIMAL(10,2) NOT NULL CHECK (peso_total_kg > 0),
    volume_carga_total DECIMAL(10,2) NOT NULL CHECK (volume_carga_total > 0),
    preco_estimado DECIMAL(10,2) COMMENT 'Preço estimado pelo sistema',
    preco_fechado DECIMAL(10,2) COMMENT 'Preço acordado entre cliente e motorista',
    status ENUM('PENDENTE', 'NEGOCIANDO', 'ACEITO', 'EM_TRANSITO', 'CONCLUIDO', 'CANCELADO') DEFAULT 'PENDENTE',
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_aceitacao TIMESTAMP NULL COMMENT 'Data em que o frete foi aceito',
    data_conclusao TIMESTAMP NULL,
    observacoes TEXT,
    FOREIGN KEY (id_cliente) REFERENCES cliente7(id_cliente) ON DELETE RESTRICT,
    FOREIGN KEY (id_motorista) REFERENCES motorista7(id_motorista) ON DELETE SET NULL,
    FOREIGN KEY (id_veiculo) REFERENCES veiculo7(id_veiculo) ON DELETE SET NULL,
    INDEX idx_id_cliente (id_cliente),
    INDEX idx_id_motorista (id_motorista),
    INDEX idx_status (status),
    INDEX idx_data_criacao (data_criacao),
    INDEX idx_coordenadas_origem (coordenada_origem_lat, coordenada_origem_lng),
    INDEX idx_coordenadas_destino (coordenada_destino_lat, coordenada_destino_lng)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: frete_item7
-- Tabela de junção (Many-to-Many)
-- Relaciona fretes com itens do catálogo
-- =====================================================
CREATE TABLE IF NOT EXISTS frete_item7 (
    id_frete_item INT AUTO_INCREMENT PRIMARY KEY,
    id_frete INT NOT NULL,
    id_item INT NOT NULL,
    quantidade INT NOT NULL DEFAULT 1 CHECK (quantidade > 0),
    peso_estimado_kg DECIMAL(10,2) NOT NULL CHECK (peso_estimado_kg > 0),
    volume_estimado_m3 DECIMAL(10,2) NOT NULL CHECK (volume_estimado_m3 > 0),
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_frete) REFERENCES frete7(id_frete) ON DELETE CASCADE,
    FOREIGN KEY (id_item) REFERENCES item_modelo7(id_item) ON DELETE RESTRICT,
    UNIQUE KEY unique_frete_item (id_frete, id_item),
    INDEX idx_id_frete (id_frete),
    INDEX idx_id_item (id_item)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: negociacao7
-- Armazena propostas de negociação de motoristas para fretes
-- =====================================================
CREATE TABLE IF NOT EXISTS negociacao7 (
    id_negociacao INT AUTO_INCREMENT PRIMARY KEY,
    id_frete INT NOT NULL,
    id_motorista INT NOT NULL,
    id_veiculo INT NOT NULL,
    preco_proposto DECIMAL(10,2) NOT NULL CHECK (preco_proposto > 0),
    distancia_km DECIMAL(10,2) NOT NULL CHECK (distancia_km >= 0),
    volume_carga DECIMAL(10,2) NOT NULL CHECK (volume_carga > 0),
    peso_carga DECIMAL(10,2) NOT NULL CHECK (peso_carga > 0),
    status ENUM('PENDENTE', 'ACEITA', 'RECUSADA', 'CANCELADA') DEFAULT 'PENDENTE',
    data_negociacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_resposta TIMESTAMP NULL COMMENT 'Data em que o cliente respondeu',
    observacoes TEXT,
    FOREIGN KEY (id_frete) REFERENCES frete7(id_frete) ON DELETE CASCADE,
    FOREIGN KEY (id_motorista) REFERENCES motorista7(id_motorista) ON DELETE CASCADE,
    FOREIGN KEY (id_veiculo) REFERENCES veiculo7(id_veiculo) ON DELETE RESTRICT,
    INDEX idx_id_frete (id_frete),
    INDEX idx_id_motorista (id_motorista),
    INDEX idx_status (status),
    INDEX idx_data_negociacao (data_negociacao)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: imagem_fret
-- Armazena URLs de imagens relacionadas a fretes e itens
-- (armazenadas no Firebase Storage ou similar)
-- =====================================================
CREATE TABLE IF NOT EXISTS imagem_fret (
    id_imagem INT AUTO_INCREMENT PRIMARY KEY,
    id_frete INT NULL COMMENT 'NULL se a imagem for apenas do item',
    id_item INT NULL COMMENT 'NULL se a imagem for apenas do frete',
    url_storage VARCHAR(500) NOT NULL,
    tipo ENUM('FOTO_CARGA', 'FOTO_ORIGEM', 'FOTO_DESTINO', 'FOTO_ITEM', 'OUTRO') DEFAULT 'OUTRO',
    data_upload TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    descricao VARCHAR(255),
    FOREIGN KEY (id_frete) REFERENCES frete7(id_frete) ON DELETE CASCADE,
    FOREIGN KEY (id_item) REFERENCES item_modelo7(id_item) ON DELETE CASCADE,
    INDEX idx_id_frete (id_frete),
    INDEX idx_id_item (id_item),
    INDEX idx_tipo (tipo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: token_notificaca
-- Armazena tokens de notificação push (FCM, APNS, etc.)
-- =====================================================
CREATE TABLE IF NOT EXISTS token_notificaca (
    id_token INT AUTO_INCREMENT PRIMARY KEY,
    id_pessoa INT NOT NULL,
    token VARCHAR(500) NOT NULL,
    plataforma ENUM('ANDROID', 'IOS', 'WEB') NOT NULL,
    ativo TINYINT(1) DEFAULT 1 COMMENT '1=Ativo, 0=Inativo',
    data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_pessoa) REFERENCES pessoa7(id_pessoa) ON DELETE CASCADE,
    INDEX idx_id_pessoa (id_pessoa),
    INDEX idx_token (token(255)),
    INDEX idx_ativo (ativo),
    INDEX idx_plataforma (plataforma)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TRIGGERS E VALIDAÇÕES
-- =====================================================

-- Trigger para atualizar data_aceitacao quando status mudar para ACEITO
DELIMITER //
CREATE TRIGGER trg_frete_aceito
BEFORE UPDATE ON frete7
FOR EACH ROW
BEGIN
    IF NEW.status = 'ACEITO' AND OLD.status != 'ACEITO' THEN
        SET NEW.data_aceitacao = CURRENT_TIMESTAMP;
    END IF;
END//
DELIMITER ;

-- Trigger para atualizar data_conclusao quando status mudar para CONCLUIDO
DELIMITER //
CREATE TRIGGER trg_frete_concluido
BEFORE UPDATE ON frete7
FOR EACH ROW
BEGIN
    IF NEW.status = 'CONCLUIDO' AND OLD.status != 'CONCLUIDO' THEN
        SET NEW.data_conclusao = CURRENT_TIMESTAMP;
    END IF;
END//
DELIMITER ;

-- =====================================================
-- VIEWS ÚTEIS
-- =====================================================

-- View para listar fretes com informações completas
CREATE OR REPLACE VIEW vw_fretes_completos AS
SELECT 
    f.id_frete,
    f.status,
    f.endereco_origem,
    f.endereco_destino,
    f.distancia_km,
    f.peso_total_kg,
    f.volume_carga_total,
    f.preco_estimado,
    f.preco_fechado,
    f.data_criacao,
    f.data_aceitacao,
    f.data_conclusao,
    c.id_cliente,
    p_cliente.nome AS nome_cliente,
    p_cliente.email AS email_cliente,
    p_cliente.telefone AS telefone_cliente,
    m.id_motorista,
    p_motorista.nome AS nome_motorista,
    p_motorista.telefone AS telefone_motorista,
    v.id_veiculo,
    v.tipo AS tipo_veiculo,
    v.placa AS placa_veiculo
FROM frete7 f
INNER JOIN cliente7 c ON f.id_cliente = c.id_cliente
INNER JOIN pessoa7 p_cliente ON c.id_pessoa = p_cliente.id_pessoa
LEFT JOIN motorista7 m ON f.id_motorista = m.id_motorista
LEFT JOIN pessoa7 p_motorista ON m.id_pessoa = p_motorista.id_pessoa
LEFT JOIN veiculo7 v ON f.id_veiculo = v.id_veiculo;

-- View para motoristas com estatísticas
CREATE OR REPLACE VIEW vw_motoristas_estatisticas AS
SELECT 
    m.id_motorista,
    p.nome,
    p.email,
    p.telefone,
    m.avaliacao_media,
    m.status,
    COUNT(DISTINCT f.id_frete) AS total_fretes,
    COUNT(DISTINCT CASE WHEN f.status = 'CONCLUIDO' THEN f.id_frete END) AS fretes_concluidos,
    COUNT(DISTINCT v.id_veiculo) AS total_veiculos
FROM motorista7 m
INNER JOIN pessoa7 p ON m.id_pessoa = p.id_pessoa
LEFT JOIN frete7 f ON m.id_motorista = f.id_motorista
LEFT JOIN veiculo7 v ON m.id_motorista = v.id_motorista
GROUP BY m.id_motorista, p.nome, p.email, p.telefone, m.avaliacao_media, m.status;

-- =====================================================
-- FIM DO SCRIPT
-- =====================================================

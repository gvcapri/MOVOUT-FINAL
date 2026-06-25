from typing import Optional, List
from datetime import datetime
from sqlmodel import Field, SQLModel, Relationship
class Motorista(SQLModel, table=True):
    __tablename__ = "motorista7" #mudanca aqui 25/06
    id: Optional[int] = Field(default=None, primary_key=True)
    nome: str
    tipo_veiculo: str
    capacidade_kg: int
    disponivel: bool = True


class PropostaFrete(SQLModel, table=True):
    __tablename__ = "propostafrete" #mudanca aqui 25/06
    id: Optional[int] = Field(default=None, primary_key=True)
    frete_id: int = Field(foreign_key="pedidofrete.id")
    motorista_id: int
    nome_motorista: str
    valor: float
    tempo_estimado: str
    rating: float = 4.8

    # Relacionamento com PedidoFrete
    frete: Optional["PedidoFrete"] = Relationship(back_populates="propostas")


class PedidoFrete(SQLModel, table=True):
    __tablename__ = "pedidofrete"  #mudanca aqui 25/06
    id: Optional[int] = Field(default=None, primary_key=True)
    descricao: str
    peso_estimado: float
    status: str = "aberto"
    origem: Optional[str] = None
    destino: Optional[str] = None
    origem_lat: Optional[float] = None
    origem_lng: Optional[float] = None
    destino_lat: Optional[float] = None
    destino_lng: Optional[float] = None
    distancia_km: Optional[float] = None
    tipo_veiculo: Optional[str] = None
    objeto_ia: Optional[str] = None
    prioridade: Optional[str] = "today"
    fragil: bool = False

    # Relacionamento com PropostaFrete
    propostas: List[PropostaFrete] = Relationship(back_populates="frete")


class MensagemChat(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    frete_id: int = Field(index=True)
    remetente: str
    texto: str
    data_hora: datetime = Field(default_factory=datetime.utcnow)

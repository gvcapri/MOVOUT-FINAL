import axios from "axios";
import { API_BASE_URL } from "./src/api/config";

// Configuração base do Axios
const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

// Funções de Autenticação
export const loginUser = async (email, senha) => {
    try {
        const response = await api.post("/auth/login", { email, senha });
        return response.data;
    } catch (error) {
        console.error("Erro ao fazer login:", error);
        throw error;
    }
};

export const registerUser = async (userData) => {
    try {
        const response = await api.post("/auth/register", userData);
        return response.data;
    } catch (error) {
        const errorMsg = error.response?.data?.detail || "Erro desconhecido no cadastro";
        console.error("Erro ao registrar usuário:", errorMsg);
        throw new Error(errorMsg);
    }
};

// Funções de Fretes e Histórico
export const fetchAvailableFreights = async () => {
    try {
        // No Python backend, as rotas estão sob /fretes
        const response = await api.get("/fretes/");
        // O backend retorna uma lista de objetos PedidoFrete
        return response.data;
    } catch (error) {
        console.error("Erro ao buscar fretes:", error);
        return [];
    }
};

export const fetchRideHistory = async () => {
    try {
        const response = await api.get("/freights/history");
        return response.data;
    } catch (error) {
        console.error("Erro ao buscar histórico:", error);
        return [];
    }
};

export const fetchRideDetails = async (rideId) => {
    try {
        const response = await api.get(`/fretes/${rideId}`);
        return response.data;
    } catch (error) {
        console.error("Erro ao buscar detalhes da corrida:", error);
        throw error;
    }
};

// Funções de Perfil e Negociação
export const updateProfile = async (profileData) => {
    try {
        const response = await api.put("/profile/update", profileData);
        return response.data;
    } catch (error) {
        console.error("Erro ao atualizar perfil:", error);
        throw error;
    }
};

export const submitProposal = async (rideId, motoristaId, nomeMotorista, value, time) => {
    try {
        const response = await api.post(`/fretes/${rideId}/proposta`, {
            motorista_id: motoristaId,
            nome_motorista: nomeMotorista,
            valor: parseFloat(value),
            tempo_estimado: time
        });
        return response.data;
    } catch (error) {
        console.error("Erro ao enviar proposta:", error);
        throw error;
    }
};

export default api;

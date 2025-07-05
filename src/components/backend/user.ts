import axios, { type AxiosResponse } from "axios";

interface User {
    id: string;
    email: string;
    name?: string;
}

interface ApiResponse<T> {
    data: T;
    message?: string;
}

const http = axios.create({
    baseURL: "http://localhost:8080/api",
    headers: {
        "Content-Type": "application/json",
    },
    withCredentials: true,
});

http.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('googleToken');
        if (token) {
            config.data = { ...config.data, googleToken: token };
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

http.interceptors.response.use(
    (response) => response,
    (error) => {
        console.error('API Error:', error.response?.data || error.message);
        return Promise.reject(error);
    }
);

const getAll = (): Promise<AxiosResponse<User[]>> => {
    return http.get("/user");
};

const get = (id: string): Promise<AxiosResponse<User>> => {
    return http.get(`/user/${id}`);
};

const create = (data: Partial<User>): Promise<AxiosResponse<User>> => {
    return http.post("/user", data);
};

const update = (id: string, data: Partial<User>): Promise<AxiosResponse<ApiResponse<null>>> => {
    return http.put(`/user/${id}`, data);
};

const remove = (id: string): Promise<AxiosResponse<ApiResponse<null>>> => {
    return http.delete(`/user/${id}`);
};

const removeAll = (): Promise<AxiosResponse<ApiResponse<null>>> => {
    return http.delete("/user");
}

export default {
    getAll,
    get,
    create,
    update,
    remove,
    removeAll,
}; 
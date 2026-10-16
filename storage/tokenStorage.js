import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "evault_access_token";

export const saveToken = async (token) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
};

export const getToken = async () => {
    return await SecureStore.getItemAsync(TOKEN_KEY);
};

export const removeToken = async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
};
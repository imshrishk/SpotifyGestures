export interface AuthCredentials {
    client_id: string;
    client_secret: string;
    redirect_uri: string;
    auth_endpoint: string;
    response_type: string;
    state: string;
    scope: string;
}

export const authCreds: AuthCredentials; 
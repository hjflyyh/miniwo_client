import { AppConst } from '../AppConst';

export type NakamaRpcResult = { success?: boolean; message?: string };

export function nakamaRpc<T extends NakamaRpcResult = NakamaRpcResult>(
    id: string,
    payloadObj: Record<string, unknown> = {},
    timeoutMs = 8000
): Promise<T> {
    return new Promise((resolve, reject) => {
        const listenerToken: Record<string, unknown> = {};
        let settled = false;
        let timeout: ReturnType<typeof setTimeout> | undefined;

        const finish = (err: Error | null, parsed?: T) => {
            if (settled) {
                return;
            }
            settled = true;
            if (timeout !== undefined) {
                clearTimeout(timeout);
            }
            EventSystem.remove(listenerToken);
            if (err) {
                reject(err);
            } else {
                resolve(parsed as T);
            }
        };

        const ok = AppConst.WebSocketManager?.send({
            rpc: { id, payload: JSON.stringify(payloadObj) },
        });
        if (!ok) {
            return finish(new Error('rpc send failed'));
        }

        timeout = setTimeout(() => finish(new Error(`rpc timeout: ${id}`)), timeoutMs);

        const onRpc = (rpcData: any) => {
            if (rpcData?.id !== id) {
                return;
            }
            try {
                const parsed =
                    typeof rpcData.payload === 'string'
                        ? JSON.parse(rpcData.payload)
                        : rpcData.payload;
                finish(null, parsed as T);
            } catch (e) {
                finish(e instanceof Error ? e : new Error(String(e)));
            }
        };

        EventSystem.addListent('WebSocketMessage', onRpc, listenerToken);
    });
}

export async function nakamaRpcOrThrow<T extends NakamaRpcResult = NakamaRpcResult>(
    id: string,
    payloadObj: Record<string, unknown> = {},
    timeoutMs = 8000
): Promise<T> {
    const res = await nakamaRpc<T>(id, payloadObj, timeoutMs);
    if (res?.success === false) {
        throw new Error(res.message || `RPC ${id} failed`);
    }
    return res;
}

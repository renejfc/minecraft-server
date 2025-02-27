import { DataByte, DataInt, DataShort, DataString, VarInt } from '~/net/types'
import { ServerBoundPacketCreator } from '../create'

export const Handshake = new ServerBoundPacketCreator(0x00, 'Handshake', {
    protocol: new VarInt(),
    hostname: new DataString(),
    port: new DataShort(),
    nextState: new VarInt(),
})

export const LegacyServerListPing = new ServerBoundPacketCreator(
    0xfe,
    'LegacyServerListPing',
    {
        fa: new DataByte(), // fa
        // mcLen: Short, // 11
        mc: new DataString(), // MC|PingHost
        restLen: new DataShort(), // 7 + len(hostname)
        protocol: new DataByte(),
        hostnameLen: new DataShort(), // len(hostname)
        hostname: new DataString(),
        port: new DataInt(), // TODO: check that this is indeed int and not varint
    }
)

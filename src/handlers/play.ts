import * as NBT from 'nbtify'
import {
    AcknowledgeMessage,
    ChatCommand,
    ChatMessage,
    CloseContainer as ServerCloseContainer,
    ConfirmTeleportation,
    Interact,
    PlayServerBoundKeepAlive,
    PlayerAction,
    PlayerCommand,
    SetHeldItem,
    SetPlayerOnGround,
    SetPlayerPosition,
    SetPlayerPositionAndRotation,
    SetPlayerRotation,
    SwingHand,
    SetCreativeModeSlot,
    PlayerAbilities,
    TeleportToEntity,
    UseItemOn,
    UseItem,
    ClickContainer,
    ChangeContainerSlotState,
    ClickContainerButton,
} from '~/net/packets/server'
import { Handler } from '.'
import {
    BlockUpdate,
    CloseContainer as ClientCloseContainer,
    EntityAnimation,
    PlayerInfoUpdate,
    SetHeadRotation,
    SpawnEntity,
    UpdateEntityPosition,
    UpdateEntityPositionAndRotation,
    UpdateEntityRotation,
} from '~/net/packets/client'
import { deltaPosition } from '~/position'
import v, { Vec3 } from 'vec3'
import type { Client } from '~/net/client'
import { EntityAnimations, Face } from '~/data/enum'

const getWorldPosition = (location: Vec3, face: number) => {
    return location
        .floor()
        .add(
            v(
                face === Face.WEST ? -1 : face === Face.EAST ? 1 : 0,
                face === Face.BOTTOM ? -1 : face === Face.TOP ? 1 : 0,
                face === Face.NORTH ? -1 : face === Face.SOUTH ? 1 : 0
            )
        )
}

export const PlayHandler = Handler.init('Play')

    .register(ConfirmTeleportation, async ({ server, client }) => {
        client.spawned = true

        const spawnEntity = await SpawnEntity.serialize(client)

        const players = server.entities.getPlayers()
        const playerInfoUpdate = await PlayerInfoUpdate(
            players.map((p) => ({
                uuid: p.entityUUID,
                playerActions: {
                    addPlayer: {
                        name: p.username || 'player',
                        properties: [],
                    },
                    signature: undefined,
                    gameMode: p.gameMode,
                    listed: true,
                    ping: (p as Client).ping,
                    displayName: new NBT.NBTData(
                        NBT.parse(
                            JSON.stringify({
                                color: 'light_purple',
                                text: p.username || 'player',
                                bold: true,
                            })
                        ),
                        { rootName: null }
                    ),
                },
            }))
        )

        await server.broadcast(client, [playerInfoUpdate, spawnEntity])
    })

    .register(AcknowledgeMessage, async ({ packet }) => {
        console.log('TODO: ACKNOWLEDGE MESSAGE')
    })

    .register(ChatCommand, async (args) => {
        await args.server.cmd.handle(args)
    })

    .register(ChatMessage, async ({ client, packet }) => {
        console.log('TODO: CHAT MESSAGE')
    })

    .register(ClickContainerButton, async ({ client, packet }) => {
        console.log('TODO: CLICK CONTAINER BUTTON')
        // use ClickContainerButtons
    })

    .register(ClickContainer, async ({ client, packet }) => {
        const { action, changedSlots, carriedItem } = packet
        const { mode, button, slot } = action

        const container = client.container
        if (!container) return // Client hasn't opened a container - should be impossible

        if (mode === 0) {
            // Click outside inventory
            if (slot === -999) {
                // Drop item
                // client.inventory.dropItem(changedSlots)
            } else {
                container.setChangedItems(client, changedSlots)
            }

            if ((button === 0 || button === 1) && carriedItem) {
                container.carryItem(client, slot, carriedItem)
            }
        } else if (mode === 5) {
            // Right-click drag
            // if (button === 5 && carriedItem) {
            //     container.setItem(slot, {
            //         itemId: carriedItem?.itemId,
            //         itemCount: 1,
            //         nbt: undefined,
            //     })
            //     client.inventory.getItem()
            // }

            // left click: button === 2, right click: button === 6
            // end of drag: slot === -999
            if ((button === 2 || button === 6) && slot === -999) {
                container.setChangedItems(client, changedSlots)
                client.inventory.setItem(
                    client.carriedItem?.slot as number,
                    carriedItem
                )
            }
        }

        // console.log('player inv', client.inventory.inv)
        // console.log('container inv', container.inv)
    })

    .register(ServerCloseContainer, async ({ server, client, packet }) => {
        if (packet.windowId === 0) {
            // Sent when the player closes the inventory, thus do nothing
            return
        }

        // Synchronize player inventory with container inventory
        const container = client.container
        if (container) {
            container.removeClient(client)
        }

        client.carriedItem = undefined
        client.windowId++

        const res = await ClientCloseContainer.serialize({
            windowId: packet.windowId,
        })
        // TODO: Why broadcast? Probably to have block animations such as chest closing => need to test
        await server.broadcast(client, res)
    })

    .register(ChangeContainerSlotState, async ({ client, packet }) => {
        console.log('TODO: ChangeContainerSlotState')
    })

    .register(Interact, async ({ client, packet }) => {
        console.log('TODO: INTERACT')
    })

    .register(PlayServerBoundKeepAlive, async ({ client, packet }) => {
        client.keepAlive(packet.id)
    })

    .register(SetPlayerPosition, async ({ server, client, packet }) => {
        const { x, y, z, onGround } = packet

        const newPosition = v(x, y, z)
        const delta = deltaPosition(client.position, newPosition)

        client.position = newPosition
        client.onGround = onGround

        await server.broadcast(
            client,
            await UpdateEntityPosition.serialize({
                entityId: client.entityId,
                ...delta,
                onGround: client.onGround,
            })
        )
    })

    .register(
        SetPlayerPositionAndRotation,
        async ({ server, client, packet }) => {
            const { yaw, pitch, x, y, z, onGround } = packet

            const newPosition = v(x, y, z)
            const delta = deltaPosition(client.position, newPosition)

            client.position = newPosition
            client.rotation = { yaw, pitch }

            await server.broadcast(client, [
                await UpdateEntityPositionAndRotation.serialize({
                    entityId: client.entityId,
                    ...delta,
                    yaw: client.yaw,
                    pitch: client.pitch,
                    onGround: client.onGround,
                }),
                await SetHeadRotation.serialize({
                    entityId: client.entityId,
                    headYaw: client.headYaw,
                }),
            ])
        }
    )

    .register(SetPlayerRotation, async ({ server, client, packet }) => {
        const { onGround, ...rotation } = packet
        client.rotation = rotation
        if (client.position !== undefined) client.onGround = onGround

        await server.broadcast(client, [
            await UpdateEntityRotation.serialize({
                entityId: client.entityId,
                yaw: client.yaw,
                pitch: rotation.pitch,
                onGround: onGround,
            }),
            await SetHeadRotation.serialize({
                entityId: client.entityId,
                headYaw: client.headYaw,
            }),
        ])
    })

    .register(SetPlayerOnGround, async ({ client, packet }) => {
        if (client.position !== undefined) client.onGround = packet.onGround
    })

    .register(PlayerCommand, async ({ client, packet }) => {
        console.log('TODO: PLAYER COMMAND')
    })

    .register(PlayerAbilities, async ({ client, packet }) => {
        client.isFlying = packet.flags === 0x02
    })

    .register(PlayerAction, async ({ client, packet }) => {
        console.log('TODO: PLAYER ACTION')
    })

    .register(SetHeldItem, async ({ client, packet }) => {
        client.inventory.heldSlotIdx = packet.slot
    })

    .register(SetCreativeModeSlot, async ({ client, packet }) => {
        const { slot, item } = packet
        client.inventory.setItem(slot, item)
        console.log(client.inventory)
    })

    .register(SwingHand, async ({ server, client, packet }) => {
        console.log('TODO: SWINGING HAND')
        server.broadcast(
            client,
            await EntityAnimation.serialize({
                entityId: client.entityId,
                animation: EntityAnimations.SWING_MAIN_ARM,
            })
        )
    })

    .register(TeleportToEntity, async ({ client, packet }) => {
        console.log('TODO: TELEPORT TO ENTITY')
    })

    .register(UseItemOn, async ({ server, client, packet }) => {
        console.log(
            'TODO: USE ITEM ON: AcknowledgeBlockChange + shift click on interactable places a block'
        )

        // 1. Check if interacting with a block
        const interactable = server.blocks.getInteractable(packet.location)
        console.log('interactable', interactable)

        // 1.2 if block is an interactable container
        if (interactable) {
            console.log('Interacting with block entity')
            return interactable.interact(client, packet)
        }

        // 2. Check if holding an item
        const slot = client.inventory.getHeldItem()
        console.log(slot)

        if (!slot) {
            console.log('No item in hand')
            return
        }

        // 3. Check if the item held is a block
        const held = client.inventory.heldBlock()
        console.log(held)

        if (!held) {
            console.log('No block in hand')
            return
        }

        const { block, name } = held

        // 4. Place the block and register it
        const worldPos = getWorldPosition(packet.location, packet.face)
        console.log('Placing block', name, 'at', worldPos)
        server.blocks.setBlock(client, worldPos, name, block)

        // TODO: better
        const state = (block as any).states.filter((s: any) => s.default)[0]
        console.log(state)

        return [
            await BlockUpdate.serialize({
                location: worldPos,
                blockId: state.id,
            }),
        ]
    })

    .register(UseItem, async ({ client, packet }) => {
        console.log('TODO: USE ITEM')
        // if ok: AcknowledgeBlockChange
    })

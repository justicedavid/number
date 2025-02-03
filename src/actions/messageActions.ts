import { firestore, database } from 'firebase';
import { ThunkAction, ThunkDispatch } from "redux-thunk";
import { seenTypes, messagesActionTypes, ExtraMessage, Message, MessageAction, MessageErrorAction, MessageList, MessageSuccessAction, messagesTypes, PostingMessage, OnlineStatus } from '../reducers/messageReducer';
import { UserInfo } from '../reducers/userReducer';
import { store } from "../store";
import { Post, ExtraPost } from '../reducers/postReducer';
import { Comment } from '../reducers/commentReducer';
import { convertToFirebaseDatabasePathName, revertFirebaseDatabasePathName } from '../utils';
import { ProfileX } from '../reducers/profileXReducer';

let allowListenChildAdd = false
export var TriggerMessageListenerRequest = ():
    ThunkAction<Promise<void>, {}, {}, MessageAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, MessageAction>) => {
        try {
            var dbRef = database()
            var ref = firestore()
            var myUsername = store.getState().user.user.userInfo?.username || ''
            var myUsernamePath = convertToFirebaseDatabasePathName(
                myUsername)

            dbRef.ref(`/messages/${(myUsernamePath)}/`).once('value', async snap => {
                var messageCollection: Message[][] = []
                var userIds: string[] = []
                snap.forEach(targetUser => {
                    if (targetUser.key !== 'forceUpdate') {
                        var userId = revertFirebaseDatabasePathName(`${targetUser.key}`)
                        if (userIds.indexOf(`${targetUser.key}`) < 0)
                            userIds.push(userId)

                        var messages: Message[] = []
                        if (snap.val() !== 'NULL') {
                            targetUser.forEach(m => {
                                messages.push({
                                    ...m.val(),
                                    userId,
                                })
                            })
                        }
                        messageCollection.push(messages)
                    }
                })
                //Listen Change 
                userIds.map(userId => {
                    //refresh listener
                    dbRef.ref(`/messages/${(myUsernamePath)}/${convertToFirebaseDatabasePathName(userId)}`).off('child_added')
                    dbRef.ref(`/messages/${(myUsernamePath)}/${convertToFirebaseDatabasePathName(userId)}`).off('child_changed')
                    dbRef.ref(`/messages/${convertToFirebaseDatabasePathName(userId)}/${(myUsernamePath)}`).off('child_added')
                    dbRef.ref(`/messages/${convertToFirebaseDatabasePathName(userId)}/${(myUsernamePath)}`).off('child_changed')

                    dbRef.ref(`/messages/${(myUsernamePath)}/${convertToFirebaseDatabasePathName(userId)}`)
                        .on('child_changed', async snap => {
                            var child: Message = snap.val()
                            var uid = child.uid
                            var realUsername = revertFirebaseDatabasePathName(userId)
                            var extraMsgIndex = store.getState().messages.findIndex(x => x.ownUser.username === realUsername)
                            if (extraMsgIndex > -1) {
                                var extraMsg = store.getState().messages[extraMsgIndex]
                                var msgIndex = extraMsg.messageList.findIndex(x => x.uid === uid)
                                if (msgIndex > -1) {
                                    extraMsg.messageList[msgIndex] = {
                                        ...child,
                                        userId
                                    }
                                    var extraMsgList = [...store.getState().messages]
                                    extraMsgList[extraMsgIndex] = { ...extraMsg }
                                    dispatch(TriggerMessageListenerSuccess(extraMsgList))
                                }
                            }
                        })
                    dbRef.ref(`/messages/${convertToFirebaseDatabasePathName(userId)}/${(myUsernamePath)}`)
                        .on('child_changed', async snap => {
                            var child: Message = snap.val()
                            var uid = child.uid
                            var realUsername = revertFirebaseDatabasePathName(userId)
                            var extraMsgIndex = store.getState().messages.findIndex(x => x.ownUser.username === realUsername)
                            if (extraMsgIndex > -1) {
                                var extraMsg = store.getState().messages[extraMsgIndex]
                                var msgIndex = extraMsg.messageList.findIndex(x => x.uid === uid)
                                if (msgIndex > -1) {
                                    extraMsg.messageList[msgIndex] = {
                                        ...child,
                                        userId: myUsername
                                    }
                                    var extraMsgList = [...store.getState().messages]
                                    extraMsgList[extraMsgIndex] = { ...extraMsg }
                                    dispatch(TriggerMessageListenerSuccess(extraMsgList))
                                }
                            }
                        })
                    dbRef.ref(`/messages/${(myUsernamePath)}/${convertToFirebaseDatabasePathName(userId)}`)
                        .on('child_added', async snap => {
                            if (allowListenChildAdd) {
                                var child: Message = snap.val()
                                var msg: Message = {
                                    ...child,
                                    userId
                                }
                                var extraMsgList = [...store.getState().messages]
                                var extraMsgIndex = extraMsgList.findIndex(x => x.ownUser.username === userId)
                                if (extraMsgIndex > -1) {
                                    var extraMsg = extraMsgList[extraMsgIndex]
                                    extraMsg.messageList = [msg, ...extraMsg.messageList]
                                    extraMsgList[extraMsgIndex] = { ...extraMsg }
                                } else {
                                    var rq = await firestore().collection('users').doc(`${userId}`).get()
                                    var userData: ProfileX = rq.data() || {}
                                    dbRef.ref(`/online/${snap.key}`).once('value', snap2 => {
                                        var extraMsg: ExtraMessage = {
                                            ownUser: userData,
                                            messageList: [msg],
                                            online: snap2.val()
                                        }
                                        var newExtraMsgList = [extraMsg, ...extraMsgList]
                                        newExtraMsgList.sort((a, b) =>
                                            (b.messageList.length > 0 ? b.messageList[0].create_at : 0) - (a.messageList.length > 0 ? a.messageList[0].create_at : 0))
                                        return dispatch(TriggerMessageListenerSuccess(newExtraMsgList))
                                    })
                                }
                                extraMsgList.sort((a, b) =>
                                    (b.messageList.length > 0 ? b.messageList[0].create_at : 0) - (a.messageList.length > 0 ? a.messageList[0].create_at : 0))
                                dispatch(TriggerMessageListenerSuccess(extraMsgList))
                            }
                        })
                    dbRef.ref(`/messages/${convertToFirebaseDatabasePathName(userId)}/${(myUsernamePath)}`)
                        .on('child_added', async snap => {
                            if (allowListenChildAdd) {
                                var child: Message = snap.val()
                                var msg: Message = {
                                    ...child,
                                    userId: myUsername
                                }
                                var extraMsgList = [...store.getState().messages]
                                var extraMsgIndex = extraMsgList.findIndex(x => x.ownUser.username === userId)
                                if (extraMsgIndex > -1) {
                                    var extraMsg = extraMsgList[extraMsgIndex]
                                    extraMsg.messageList = [msg, ...extraMsg.messageList]
                                    extraMsgList[extraMsgIndex] = { ...extraMsg }
                                } else {
                                    var rq = await firestore().collection('users').doc(`${userId}`).get()
                                    var userData: ProfileX = rq.data() || {}
                                    dbRef.ref(`/online/${snap.key}`).once('value', snap2 => {
                                        var extraMsg: ExtraMessage = {
                                            ownUser: userData,
                                            messageList: [msg],
                                            online: snap2.val()
                                        }
                                        var newExtraMsgList = [extraMsg, ...extraMsgList]
                                        extraMsgList.sort((a, b) =>
                                            (b.messageList.length > 0 ? b.messageList[0].create_at : 0) - (a.messageList.length > 0 ? a.messageList[0].create_at : 0))
                                        return dispatch(TriggerMessageListenerSuccess(newExtraMsgList))
                                    })
                                }
                                extraMsgList.sort((a, b) =>
                                    (b.messageList.length > 0 ? b.messageList[0].create_at : 0) - (a.messageList.length > 0 ? a.messageList[0].create_at : 0))
                                dispatch(TriggerMessageListenerSuccess(extraMsgList))
                            }
                        })
                })






                var fetchMyMessagesTasks = userIds.map((userId, index) => {
                    return new Promise((resolve, reject) => {
                        dbRef.ref(`/messages/${convertToFirebaseDatabasePathName(userId)}/${(myUsernamePath)}`)
                            .once('value', snap2 => {
                                resolve()
                                if (snap2.val() !== 'NULL') {
                                    snap2.forEach(m => {
                                        messageCollection[index].push({
                                            ...m.val(),
                                            userId: myUsername
                                        })
                                    })
                                }
                                messageCollection[index].sort((a, b) => b.create_at - a.create_at)
                            })
                    })
                })
                var fetchUserStatusTasks = userIds.map((userId, index) => {
                    return new Promise<OnlineStatus>((resolve, reject) => {
                        dbRef.ref(`/online/${convertToFirebaseDatabasePathName(userId)}`)
                            .once('value', snap3 => {
                                resolve(snap3.val() as OnlineStatus)
                            })
                    })
                })
                Promise.all(fetchMyMessagesTasks).then(async () => {
                    var preUserInfos: ProfileX[] = store.getState().messages.map(x => x.ownUser)
                    var fetchUserInfoListTasks: Promise<ProfileX>[] = userIds
                        .map(async userId => {
                            let idx = -1
                            preUserInfos.find((x, index) => {
                                if (x.username === userId) idx = index
                                return x.username === userId
                            })
                            if (idx > -1) {
                                return preUserInfos[idx]
                            }
                            var rq = await ref.collection('users')
                                .doc(`${userId}`).get()
                            var userData: ProfileX = rq.data() || {}
                            return userData
                        })
                    var userInfos: ProfileX[] = await Promise.all(fetchUserInfoListTasks)
                    var onlineStatus: OnlineStatus[] = await Promise.all(fetchUserStatusTasks)
                    var collection: MessageList = messageCollection.map((messageGroup, index) => {
                        return {
                            messageList: messageGroup,
                            ownUser: userInfos[index],
                            online: onlineStatus[index]
                        }
                    })
                    collection.sort((a, b) =>
                        (b.messageList.length > 0 ? b.messageList[0].create_at : 0) - (a.messageList.length > 0 ? a.messageList[0].create_at : 0))
                    allowListenChildAdd = true
                    dispatch(TriggerMessageListenerSuccess(collection))
                })

            })

            // 
        } catch (e) {
            console.warn(e)
            dispatch(TriggerMessageListenerFailure())
        }
    }
}
export var TriggerMessageListenerFailure = (): MessageErrorAction => {
    return {
        type: messagesActionTypes.TRIGGER_MESSAGES_LISTENER_FAILURE,
        payload: {
            message: 'Get Messages Failed!'
        }
    }
}
export var TriggerMessageListenerSuccess = (payload: MessageList): MessageSuccessAction<MessageList> => {
    return {
        type: messagesActionTypes.TRIGGER_MESSAGES_LISTENER_SUCCESS,
        payload: payload
    }
}
export var CreateMessageRequest = (message: PostingMessage, targetUsername: string):
    ThunkAction<Promise<void>, {}, {}, MessageAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, MessageAction>) => {
        try {
            var targetUsernamePath = convertToFirebaseDatabasePathName(targetUsername)
            var myUsername = store.getState().user.user.userInfo?.username || ''
            var myUsernamePath = convertToFirebaseDatabasePathName(
                myUsername)
            var dbRef = database()
            var ref = firestore()
            var uid = message.uid || new Date().getTime()
            var msg = {
                ...message,
                userId: myUsername,
                uid,
            }
            dbRef.ref(`/messages/${targetUsernamePath}/${myUsernamePath}/${uid}`)
                .set(msg)
            // var extraMsg = store.getState().messages.find(x => x.ownUser.username === targetUsername)
            // if (extraMsg) {
            //     var index = store.getState().messages.findIndex(x => x === extraMsg)
            //     var newExtraMsg = { ...extraMsg }
            //     newExtraMsg.messageList = [msg, ...newExtraMsg.messageList]
            //     var newExtraList = [...store.getState().messages]
            //     newExtraList[index] = newExtraMsg
            //     dispatch(TriggerMessageListenerSuccess(newExtraList))
            // } else {
            //     var rq = await ref.collection('users').doc(`${targetUsername}`).get()
            //     var targetUserData: ProfileX = rq.data() || {}
            //     dbRef.ref(`/online/${targetUsernamePath}`).once('value', snap => {
            //         var newExtraMsg: ExtraMessage = {
            //             messageList: [msg],
            //             ownUser: targetUserData,
            //             online: snap.val()
            //         }
            //         var newExtraList = [...store.getState().messages]
            //         newExtraList.push(newExtraMsg)
            //         dispatch(TriggerMessageListenerSuccess(newExtraList))
            //     })
            // }
        } catch (e) {
            console.warn(e)
            dispatch(TriggerMessageListenerFailure())
        }
    }
}
export var MakeSeenRequest = (targetUsername: string, msgUid: number):
    ThunkAction<Promise<void>, {}, {}, MessageAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, MessageAction>) => {
        try {
            var targetUsernamePath = convertToFirebaseDatabasePathName(targetUsername)
            var myUsername = store.getState().user.user.userInfo?.username || ''
            var myUsernamePath = convertToFirebaseDatabasePathName(
                myUsername)
            var dbRef = database()
            dbRef.ref(`/messages/${myUsernamePath}/${targetUsernamePath}/${msgUid}`)
                .update({
                    seen: seenTypes.SEEN
                })
            dbRef.ref(`/messages/${targetUsernamePath}/forceUpdate`).set(Math.random())
            var extraMsg = store.getState().messages.find(x => x.ownUser.username === targetUsername)
            if (extraMsg) {
                var msg = extraMsg.messageList.find(x => x.uid === msgUid)
                if (msg) {
                    msg.seen = 1
                    dispatch(TriggerMessageListenerSuccess([...store.getState().messages]))
                } else dispatch(TriggerMessageListenerFailure())
            } else dispatch(TriggerMessageListenerFailure())
        } catch (e) {
            console.warn(e)
            dispatch(TriggerMessageListenerFailure())
        }
    }
}
export var CreateEmptyConversationRequest = (targetUsername: string):
    ThunkAction<Promise<void>, {}, {}, MessageAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, MessageAction>) => {
        try {
            var targetUsernamePath = convertToFirebaseDatabasePathName(targetUsername)
            var myUsername = store.getState().user.user.userInfo?.username || ''
            var myUsernamePath = convertToFirebaseDatabasePathName(
                myUsername)
            var dbRef = database()
            var ref = firestore()
            var rq = await ref.collection('users').doc(`${targetUsername}`).get()
            if (rq.exists) {
                dbRef.ref(`/messages/${targetUsernamePath}/${myUsernamePath}`)
                    .set('NULL')
                dbRef.ref(`/messages/${myUsernamePath}/${targetUsernamePath}`)
                    .set('NULL')
                var extraMsg = store.getState().messages.find(x => x.ownUser.username === targetUsername)
                var targetUserData: ProfileX = rq.data() || {}
                dbRef.ref(`/online/${targetUsernamePath}`).once('value', snap => {
                    var newExtraMsg: ExtraMessage = {
                        messageList: [],
                        ownUser: targetUserData,
                        online: snap.val()
                    }
                    var newExtraList = [newExtraMsg, ...store.getState().messages]
                    newExtraList.sort((a, b) =>
                        (b.messageList.length > 0 ? b.messageList[0].create_at : 0) - (a.messageList.length > 0 ? a.messageList[0].create_at : 0))
                    dispatch(TriggerMessageListenerSuccess(newExtraList))
                    dispatch(TriggerMessageListenerRequest())
                })
            } else dispatch(TriggerMessageListenerFailure())
        } catch (e) {
            console.warn(e)
            dispatch(TriggerMessageListenerFailure())
        }
    }
}
export var AddEmoijToMessageRequest = (targetUsername: string, msgId: number, emoji: number):
    ThunkAction<Promise<void>, {}, {}, MessageAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, MessageAction>) => {
        try {
            var targetUsernamePath = convertToFirebaseDatabasePathName(targetUsername)
            var myUsername = store.getState().user.user.userInfo?.username || ''
            var myUsernamePath = convertToFirebaseDatabasePathName(
                myUsername)
            var dbRef = database()
            var extraMsgIndex = store.getState().messages.findIndex(x => x.ownUser.username === targetUsername)
            if (extraMsgIndex > -1) {
                var extraMsg = store.getState().messages[extraMsgIndex]
                var msgIndex = extraMsg.messageList.findIndex(x => x.uid === msgId)
                if (msgIndex > -1) {
                    var msg = extraMsg.messageList[msgIndex]
                    if (msg.userId === targetUsername) {
                        dbRef.ref(`/messages/${myUsernamePath}/${targetUsernamePath}/${msgId}/yourEmoji`)
                            .set(emoji)

                    } else if (msg.userId === myUsername) {
                        dbRef.ref(`/messages/${targetUsernamePath}/${myUsernamePath}/${msgId}/ownEmoji`)
                            .set(emoji)
                    }
                } else dispatch(TriggerMessageListenerFailure())
            } else dispatch(TriggerMessageListenerFailure())
        } catch (e) {
            console.warn(e)
            dispatch(TriggerMessageListenerFailure())
        }
    }
}
export var RemoveEmoijToMessageRequest = (targetUsername: string, msgId: number):
    ThunkAction<Promise<void>, {}, {}, MessageAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, MessageAction>) => {
        try {
            var targetUsernamePath = convertToFirebaseDatabasePathName(targetUsername)
            var myUsername = store.getState().user.user.userInfo?.username || ''
            var myUsernamePath = convertToFirebaseDatabasePathName(
                myUsername)
            var dbRef = database()
            var extraMsgIndex = store.getState().messages.findIndex(x => x.ownUser.username === targetUsername)
            if (extraMsgIndex > -1) {
                var extraMsg = store.getState().messages[extraMsgIndex]
                var msgIndex = extraMsg.messageList.findIndex(x => x.uid === msgId)
                if (msgIndex > -1) {
                    var msg = extraMsg.messageList[msgIndex]
                    if (msg.userId === targetUsername) {
                        dbRef.ref(`/messages/${myUsernamePath}/${targetUsernamePath}/${msgId}/yourEmoji`).remove()

                    } else if (msg.userId === myUsername) {
                        dbRef.ref(`/messages/${targetUsernamePath}/${myUsernamePath}/${msgId}/ownEmoji`).remove()
                    }
                } else dispatch(TriggerMessageListenerFailure())
            } else dispatch(TriggerMessageListenerFailure())
        } catch (e) {
            console.warn(e)
            dispatch(TriggerMessageListenerFailure())
        }
    }
}
export var UndoMyLastMessageRequest = (targetUsername: string):
    ThunkAction<Promise<void>, {}, {}, MessageAction> => {
    return async (dispatch: ThunkDispatch<{}, {}, MessageAction>) => {
        try {
            var targetUsernamePath = convertToFirebaseDatabasePathName(targetUsername)
            var myUsername = store.getState().user.user.userInfo?.username || ''
            var myUsernamePath = convertToFirebaseDatabasePathName(
                myUsername)
            var dbRef = database()
            dbRef.ref(`/messages/${targetUsernamePath}/${myUsernamePath}`).once('value', snap => {
                var msgList: Message[] = []
                snap.forEach(msg => {
                    msgList.push(msg.val())
                })
                var myLastMsg = msgList.pop()
                if (myLastMsg) {
                    var uid = myLastMsg.uid
                    dbRef.ref(`/messages/${targetUsernamePath}/${myUsernamePath}/${uid}`).remove()
                    dispatch(TriggerMessageListenerRequest())
                }
            })
        } catch (e) {
            console.warn(e)
            dispatch(TriggerMessageListenerFailure())
        }
    }
}
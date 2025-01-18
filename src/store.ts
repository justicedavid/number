import { createStore, applyMiddleware, compose } from 'redux'
import { persistStore, persistReducer } from 'redux-persist'
import AsyncStorage from '@react-native-community/async-storage'
let persistConfig = {
    key: 'root',
    storage: AsyncStorage,
    whitelist: ['user']
}
import rootReducer from './reducers/'

let persistedReducer = persistReducer(persistConfig, rootReducer)

import thunk from 'redux-thunk';
let middlewares = [thunk]
let enhancers = [applyMiddleware(...middlewares)]
export let store = createStore(persistedReducer, compose(...enhancers))
export let persistor = persistStore(store)
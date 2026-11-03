"use client";
import {useCallback, useEffect, useRef, useState} from "react";
type User = {id:string; email:string};

import {initialData, type Data} from "@/lib/domain";
import {loadData} from "@/lib/storage";

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return "Не удалось выполнить действие. Проверь подключение и попробуй ещё раз.";
}

export function useLifeHub() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [data, setData] = useState<Data>(initialData);
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Загрузка…");
  const [error, setError] = useState("");
  const [online, setOnline] = useState(true);
  const lock = useRef(false);
  const generation = useRef(0);
  const userId = user?.id;

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {window.removeEventListener("online", update); window.removeEventListener("offline", update);};
  }, []);

  useEffect(() => {
    let active = true;
    fetch('/api/session', {cache:'no-store'}).then(async response => {
      if (!response.ok) throw new Error('Сессия недоступна. Войди через ChatGPT.');
      const session = await response.json() as {user:User|null};
      if (active) setUser(session.user);
    }).catch(e => {if(active) setAuthError(errorMessage(e));})
      .finally(() => {if(active) setAuthLoading(false);});
    return () => {active = false;};
  }, []);

  const reload = useCallback(async () => {
    if (!userId || lock.current) return;
    lock.current = true;
    const ticket = ++generation.current;
    setRefreshing(true); setStatus("Обновление данных…"); setError("");
    try {
      const loaded = await loadData(userId);
      if (ticket !== generation.current) return;
      setData(loaded); setReady(true); setStatus("Синхронизировано");
    } catch (e) {
      if (ticket === generation.current) {setError(errorMessage(e)); setStatus("Не удалось загрузить данные");}
    } finally {
      if (ticket === generation.current) {lock.current = false; setRefreshing(false);}
    }
  }, [userId]);

  useEffect(() => {
    lock.current = false; setBusy(false); setRefreshing(false);
    setData(initialData); setReady(false); setError("");
    void reload();
    const counter = generation;
    return () => {counter.current++;};
  }, [reload]);

  const perform = async (action: () => Promise<Data | void>, success = "Сохранено в облаке") => {
    if (lock.current || !userId) return false;
    if (!navigator.onLine) {setError("Нет подключения. Изменения ещё не сохранены. Повтори после подключения."); return false;}
    lock.current = true; setBusy(true); setError(""); setStatus("Сохранение…");
    const ticket = generation.current;
    try {
      const next = await action();
      if (ticket !== generation.current) return false;
      if (next) setData(next);
      setStatus(success);
      return true;
    } catch (e) {
      if (ticket === generation.current) {setError(errorMessage(e)); setStatus("Изменения не сохранены");}
      return false;
    } finally {if (ticket === generation.current) {lock.current = false; setBusy(false);}}
  };

  return {user, authLoading, authError, setAuthError, data, setData, ready, busy, refreshing, status, error, setError, online, reload, perform};
}

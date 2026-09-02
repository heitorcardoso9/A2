import { useEffect, useState } from 'react';

let estadosPromise = null;
const cidadesPorUf = new Map();

export async function fetchEstados() {
  if (!estadosPromise) {
    estadosPromise = fetch(
      'https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome'
    )
      .then((r) => r.json())
      .catch((err) => {
        estadosPromise = null;
        return [];
      });
  }
  return estadosPromise;
}

export async function fetchCidades(uf) {
  if (!uf) return [];
  if (!cidadesPorUf.has(uf)) {
    const promise = fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`
    )
      .then((r) => r.json())
      .then((lista) => lista.map((m) => m.nome).sort((a, b) => a.localeCompare(b)))
      .catch((err) => {
        cidadesPorUf.delete(uf);
        return [];
      });
    cidadesPorUf.set(uf, promise);
    return promise;
  }
  return cidadesPorUf.get(uf);
}

export function useIBGEEstados() {
  const [estados, setEstados] = useState([]);
  useEffect(() => {
    let cancelado = false;
    fetchEstados().then((lista) => {
      if (!cancelado) setEstados(lista);
    });
    return () => {
      cancelado = true;
    };
  }, []);
  return estados;
}

export function useIBGECidades(uf) {
  const [cidades, setCidades] = useState([]);
  const [carregando, setCarregando] = useState(false);
  useEffect(() => {
    let cancelado = false;
    if (!uf) {
      setCidades([]);
      return;
    }
    setCarregando(true);
    fetchCidades(uf).then((lista) => {
      if (!cancelado) {
        setCidades(lista);
        setCarregando(false);
      }
    });
    return () => {
      cancelado = true;
    };
  }, [uf]);
  return { cidades, carregando };
}

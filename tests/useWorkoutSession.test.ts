import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWorkoutSession } from "../hooks/useWorkoutSession";

describe("useWorkoutSession", () => {
  const mockAlumnoId = "alumno-123";
  const mockGymId = "gym-456";
  const mockToken = "token-789";

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();

    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;

    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
  });

  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("initializes with null workoutSession", () => {
    const { result } = renderHook(() =>
      useWorkoutSession(mockAlumnoId, mockGymId, mockToken)
    );

    expect(result.current.workoutSession).toBeNull();
    expect(result.current.wsSyncing).toBe(false);
  });

  it("loads saved workout session from localStorage", () => {
    const today = new Date().toISOString().slice(0, 10);
    const saved = {
      rutina_nombre: "Pecho",
      series_log: {
        "Press de pecho": { completadas: 2, total: 4, kg_usado: 60 },
      },
      completada: false,
      offline: false,
      inicio: new Date().toISOString(),
    };

    localStorage.setItem(`fitgrowx_ws_${mockAlumnoId}_${today}`, JSON.stringify(saved));

    const { result } = renderHook(() =>
      useWorkoutSession(mockAlumnoId, mockGymId, mockToken)
    );

    expect(result.current.workoutSession).toEqual(saved);
  });

  it("initializes new workout session", () => {
    const { result } = renderHook(() =>
      useWorkoutSession(mockAlumnoId, mockGymId, mockToken)
    );

    act(() => {
      result.current.initSession("Pecho", [
        { nombre: "Press de pecho", series: 4 },
        { nombre: "Aperturas", series: 3 },
      ]);
    });

    expect(result.current.workoutSession).not.toBeNull();
    expect(result.current.workoutSession!.rutina_nombre).toBe("Pecho");
    expect(result.current.workoutSession!.series_log["Press de pecho"]).toEqual({
      completadas: 0,
      total: 4,
      kg_usado: null,
    });
  });

  it("does not reinitialize if session already exists", () => {
    const today = new Date().toISOString().slice(0, 10);
    const saved = {
      rutina_nombre: "Espalda",
      series_log: {},
      completada: false,
      offline: false,
      inicio: new Date().toISOString(),
    };

    localStorage.setItem(`fitgrowx_ws_${mockAlumnoId}_${today}`, JSON.stringify(saved));

    const { result } = renderHook(() =>
      useWorkoutSession(mockAlumnoId, mockGymId, mockToken)
    );

    act(() => {
      result.current.initSession("Pecho", [
        { nombre: "Press de pecho", series: 4 },
      ]);
    });

    expect(result.current.workoutSession!.rutina_nombre).toBe("Espalda");
  });

  it("marks series as completed", () => {
    const { result } = renderHook(() =>
      useWorkoutSession(mockAlumnoId, mockGymId, mockToken)
    );

    act(() => {
      result.current.initSession("Pecho", [
        { nombre: "Press de pecho", series: 4 },
      ]);
    });

    act(() => {
      result.current.markSerie("Press de pecho", 0);
    });

    expect(result.current.workoutSession!.series_log["Press de pecho"].completadas).toBe(1);

    act(() => {
      result.current.markSerie("Press de pecho", 1);
    });

    expect(result.current.workoutSession!.series_log["Press de pecho"].completadas).toBe(2);
  });

  it("toggles series completion when clicking same index", () => {
    const { result } = renderHook(() =>
      useWorkoutSession(mockAlumnoId, mockGymId, mockToken)
    );

    act(() => {
      result.current.initSession("Pecho", [
        { nombre: "Press de pecho", series: 4 },
      ]);
    });

    act(() => {
      result.current.markSerie("Press de pecho", 1);
    });

    expect(result.current.workoutSession!.series_log["Press de pecho"].completadas).toBe(2);

    act(() => {
      result.current.markSerie("Press de pecho", 1);
    });

    expect(result.current.workoutSession!.series_log["Press de pecho"].completadas).toBe(1);
  });

  it("sets exercise weight (kg)", () => {
    const { result } = renderHook(() =>
      useWorkoutSession(mockAlumnoId, mockGymId, mockToken)
    );

    act(() => {
      result.current.initSession("Pecho", [
        { nombre: "Press de pecho", series: 4 },
      ]);
    });

    act(() => {
      result.current.setSerieKg("Press de pecho", 75);
    });

    expect(result.current.workoutSession!.series_log["Press de pecho"].kg_usado).toBe(75);
  });

  it("persists changes to localStorage", () => {
    const today = new Date().toISOString().slice(0, 10);
    const { result } = renderHook(() =>
      useWorkoutSession(mockAlumnoId, mockGymId, mockToken)
    );

    act(() => {
      result.current.initSession("Pecho", [
        { nombre: "Press de pecho", series: 4 },
      ]);
    });

    const saved = localStorage.getItem(`fitgrowx_ws_${mockAlumnoId}_${today}`);
    expect(saved).not.toBeNull();

    const parsedSaved = JSON.parse(saved!);
    expect(parsedSaved.rutina_nombre).toBe("Pecho");
  });

  it("finalizes workout and syncs to server when online", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;

    const { result } = renderHook(() =>
      useWorkoutSession(mockAlumnoId, mockGymId, mockToken)
    );

    act(() => {
      result.current.initSession("Pecho", [
        { nombre: "Press de pecho", series: 4 },
      ]);
    });

    let finalizeOk: any;
    await act(async () => {
      finalizeOk = await result.current.finalizeWorkout();
    });

    expect(finalizeOk).toBeTruthy();
    expect(result.current.workoutSession!.completada).toBe(true);
  });

  it("finalizes workout offline without syncing", async () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });

    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    const { result } = renderHook(() =>
      useWorkoutSession(mockAlumnoId, mockGymId, mockToken)
    );

    act(() => {
      result.current.initSession("Pecho", [
        { nombre: "Press de pecho", series: 4 },
      ]);
    });

    let finalizeOk: any;
    await act(async () => {
      finalizeOk = await result.current.finalizeWorkout();
    });

    expect(finalizeOk).toBeFalsy();
    expect(result.current.workoutSession!.completada).toBe(true);
    expect(result.current.workoutSession!.offline).toBe(true);
  });

  it("flushes offline workout session when coming online", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;

    const today = new Date().toISOString().slice(0, 10);
    const offlineSession = {
      rutina_nombre: "Pecho",
      series_log: { "Press de pecho": { completadas: 4, total: 4, kg_usado: 60 } },
      completada: true,
      offline: true,
      inicio: new Date().toISOString(),
    };

    localStorage.setItem(`fitgrowx_ws_${mockAlumnoId}_${today}`, JSON.stringify(offlineSession));

    const { result } = renderHook(() =>
      useWorkoutSession(mockAlumnoId, mockGymId, mockToken)
    );

    await act(async () => {
      await result.current.flushWorkoutSession();
    });

    expect(mockFetch).toHaveBeenCalled();
  });

  it("enqueues kg for later syncing", () => {
    const { result } = renderHook(() =>
      useWorkoutSession(mockAlumnoId, mockGymId, mockToken)
    );

    act(() => {
      result.current.enqueueKg({
        alumno_id: mockAlumnoId,
        gym_id: mockGymId,
        ejercicio: "Press de pecho",
        peso: 80,
      });
    });

    const queue = localStorage.getItem(`fitgrowx_kgq_${mockAlumnoId}`);
    expect(queue).not.toBeNull();

    const parsedQueue = JSON.parse(queue!);
    expect(parsedQueue).toHaveLength(1);
    expect(parsedQueue[0].ejercicio).toBe("Press de pecho");
    expect(parsedQueue[0].peso).toBe(80);
  });

  it("flushes kg queue to server", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;

    const queue = [
      {
        alumno_id: mockAlumnoId,
        gym_id: mockGymId,
        ejercicio: "Press de pecho",
        peso: 80,
      },
      {
        alumno_id: mockAlumnoId,
        gym_id: mockGymId,
        ejercicio: "Aperturas",
        peso: 50,
      },
    ];

    localStorage.setItem(`fitgrowx_kgq_${mockAlumnoId}`, JSON.stringify(queue));

    const { result } = renderHook(() =>
      useWorkoutSession(mockAlumnoId, mockGymId, mockToken)
    );

    await act(async () => {
      await result.current.flushKgQueue();
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("removes successfully synced kg items from queue", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;

    const queue = [
      {
        alumno_id: mockAlumnoId,
        gym_id: mockGymId,
        ejercicio: "Press de pecho",
        peso: 80,
      },
    ];

    localStorage.setItem(`fitgrowx_kgq_${mockAlumnoId}`, JSON.stringify(queue));

    const { result } = renderHook(() =>
      useWorkoutSession(mockAlumnoId, mockGymId, mockToken)
    );

    await act(async () => {
      await result.current.flushKgQueue();
    });

    const remaining = localStorage.getItem(`fitgrowx_kgq_${mockAlumnoId}`);
    const parsedRemaining = JSON.parse(remaining!);
    expect(parsedRemaining).toHaveLength(0);
  });

  it("handles missing alumnoId gracefully", () => {
    const { result } = renderHook(() =>
      useWorkoutSession(null, mockGymId, mockToken)
    );

    expect(result.current.workoutSession).toBeNull();

    act(() => {
      result.current.initSession("Pecho", [
        { nombre: "Press de pecho", series: 4 },
      ]);
    });

    expect(result.current.workoutSession).toBeNull();
  });
});

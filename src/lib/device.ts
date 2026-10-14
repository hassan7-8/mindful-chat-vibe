const KEY = "cm_device_id";

/** A random id that identifies this browser/device. */
export function getDeviceId() {
  let id = localStorage.getItem(KEY);
  if (!id || !/^[a-zA-Z0-9-]{16,64}$/.test(id)) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

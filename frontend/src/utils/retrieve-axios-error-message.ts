import { isAxiosError } from "axios";

export const retrieveAxiosErrorMessage = (error: unknown) => {
  if (isAxiosError(error)) {
    const data = error.response?.data;

    if (data && typeof data === "object") {
      if (typeof (data as { error?: unknown }).error === "string") {
        return (data as { error: string }).error;
      }

      if (typeof (data as { message?: unknown }).message === "string") {
        return (data as { message: string }).message;
      }
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "";
};

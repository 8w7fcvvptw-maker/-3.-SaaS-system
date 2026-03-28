import { createContext, useContext, useState } from "react";

const BookingContext = createContext(null);

export function BookingProvider({ children, business = null, slug = "" }) {
  const [booking, setBooking] = useState({
    service: null,
    staff: null,
    date: null,
    time: null,
    clientName: "",
    clientPhone: "",
    clientEmail: "",
    notes: "",
  });

  const updateBooking = (updates) => {
    setBooking((p) => ({ ...p, ...updates }));
  };

  const resetBooking = () => {
    setBooking({
      service: null,
      staff: null,
      date: null,
      time: null,
      clientName: "",
      clientPhone: "",
      clientEmail: "",
      notes: "",
    });
  };

  return (
    <BookingContext.Provider
      value={{
        booking,
        business,
        businessId: business?.id ?? null,
        slug: slug || "",
        updateBooking,
        resetBooking,
      }}
    >
      {children}
    </BookingContext.Provider>
  );
}

export function useBooking() {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error("useBooking must be used within BookingProvider");
  return ctx;
}

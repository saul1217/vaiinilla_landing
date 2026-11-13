import { describe, expect, it } from 'vitest';
import { hotelPath, isHotelGuestEnabled } from './hotel-routes';

describe('bandera del huésped de hotel', () => {
  it('solo se prende con el texto true', () => {
    expect(isHotelGuestEnabled('true')).toBe(true);
    expect(isHotelGuestEnabled(' TRUE ')).toBe(true);
    expect(isHotelGuestEnabled(undefined)).toBe(false);
    expect(isHotelGuestEnabled('')).toBe(false);
    expect(isHotelGuestEnabled('false')).toBe(false);
    expect(isHotelGuestEnabled('1')).toBe(false);
  });

  it('arma las rutas del huésped dentro del negocio', () => {
    expect(hotelPath('hotel-sol')).toBe('/e/hotel-sol/hotel');
    expect(hotelPath('hotel-sol', 'cuenta')).toBe('/e/hotel-sol/hotel/cuenta');
  });
});

export function isValidIsraeliId(id: string): boolean {
  if (!/^\d{9}$/.test(id)) return false;

  const sum = id.split("").reduce((acc, char, index) => {
    let num = Number(char) * (index % 2 === 0 ? 1 : 2);
    if (num > 9) num -= 9;
    return acc + num;
  }, 0);

  return sum % 10 === 0;
}

export function isValidPassportNumber(passport: string): boolean {
  return /^\d{8}$/.test(passport);
}

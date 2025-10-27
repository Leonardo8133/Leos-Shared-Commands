"""Example module for flowchart generation tests."""

def compute_factorial(n: int) -> int:
    """Compute factorial iteratively."""
    result = 1
    for value in range(2, n + 1):
        result *= value
    return result


def main() -> None:
    """Entry point."""
    total = 0
    for item in range(1, 6):
        total += compute_factorial(item)
    print(f"Aggregated factorial: {total}")


if __name__ == "__main__":
    main()

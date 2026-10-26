# deliverable.py

class Fuel:
    """
    Fuel management for flight in bounty-arcade.
    Handles fuel consumption, refueling, and status checks.
    """

    def __init__(self, max_fuel: float, consumption_rate: float):
        """
        Initialize the Fuel object.

        Args:
            max_fuel (float): The maximum fuel capacity.
            consumption_rate (float): Fuel consumed per unit distance or time.
        """
        if max_fuel <= 0:
            raise ValueError("max_fuel must be positive.")
        if consumption_rate < 0:
            raise ValueError("consumption_rate must be non-negative.")
        self.max_fuel = max_fuel
        self.current_fuel = max_fuel
        self.consumption_rate = consumption_rate

    def consume(self, amount: float) -> float:
        """
        Consume a given amount of fuel.

        Args:
            amount (float): Amount of fuel to consume.

        Returns:
            float: Actual amount of fuel consumed.
        """
        if amount < 0:
            raise ValueError("Cannot consume negative fuel.")
        consumed = min(self.current_fuel, amount)
        self.current_fuel -= consumed
        return consumed

    def consume_for_distance(self, distance: float) -> float:
        """
        Consume fuel based on distance flown.

        Args:
            distance (float): Distance to fly.

        Returns:
            float: Actual distance flown based on available fuel.
        """
        if distance < 0:
            raise ValueError("Distance must be non-negative.")
        required_fuel = distance * self.consumption_rate
        if required_fuel <= self.current_fuel:
            self.current_fuel -= required_fuel
            return distance
        else:
            # Not enough fuel for full distance, fly as far as possible
            possible_distance = self.current_fuel / self.consumption_rate if self.consumption_rate > 0 else 0
            self.current_fuel = 0
            return possible_distance

    def refuel(self, amount: float) -> float:
        """
        Refuel by a given amount.

        Args:
            amount (float): Amount of fuel to add.

        Returns:
            float: Actual amount of fuel added.
        """
        if amount < 0:
            raise ValueError("Cannot refuel negative amount.")
        space_left = self.max_fuel - self.current_fuel
        added = min(space_left, amount)
        self.current_fuel += added
        return added

    def is_empty(self) -> bool:
        """
        Check if fuel is empty.

        Returns:
            bool: True if fuel is empty, False otherwise.
        """
        return self.current_fuel <= 0

    def is_full(self) -> bool:
        """
        Check if fuel tank is full.

        Returns:
            bool: True if fuel is full, False otherwise.
        """
        return self.current_fuel >= self.max_fuel

    def get_fuel_level(self) -> float:
        """
        Get the current fuel level.

        Returns:
            float: Current fuel level.
        """
        return self.current_fuel

    def get_fuel_percentage(self) -> float:
        """
        Get the current fuel level as a percentage of max.

        Returns:
            float: Percentage of fuel remaining (0.0 - 1.0).
        """
        return self.current_fuel / self.max_fuel if self.max_fuel > 0 else 0.0

    def __repr__(self):
        return f"Fuel({self.current_fuel:.2f}/{self.max_fuel:.2f})"

# Example usage (for testing purposes only):
if __name__ == "__main__":
    # Create a fuel tank with 100 units max, 0.5 per distance unit
    fuel = Fuel(max_fuel=100.0, consumption_rate=0.5)
    print(fuel)
    print("Consume 10 units:", fuel.consume(10))
    print(fuel)
    print("Fly 50 units distance:", fuel.consume_for_distance(50))
    print(fuel)
    print("Refuel 20 units:", fuel.refuel(20))
    print(fuel)
    print("Is empty?", fuel.is_empty())
    print("Is full?", fuel.is_full())
    print("Fuel percentage:", fuel.get_fuel_percentage())
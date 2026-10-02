"use client";

import { useMemo, useState } from "react";
import SearchableSelect from "@/components/SearchableSelect";

type NamedOption = { id: number; name: string };
type SubunitOption = NamedOption & { departmentId: number };
type CostCenterOption = { id: number; code: string };
type MappingOption = {
  id: number;
  locationId: number;
  subunitId: number;
  costCenterId: number;
};

export type OrganizationFieldOptions = {
  locations: NamedOption[];
  departments: NamedOption[];
  subunits: SubunitOption[];
  costCenters: CostCenterOption[];
  mappings: MappingOption[];
};

export default function OrganizationFields({
  options,
  initialLocationId = null,
  initialDepartmentId = null,
  initialSubunitId = null,
  initialCostCenterId = null,
  requiredLocation = false,
  requiredDepartment = false,
  requiredSubunit = false,
  requiredCostCenter = false,
  showCostCenter = true,
  locationFieldName = "locationId",
  floatingLabel = false,
  disabled = false,
  errors,
  className = "grid gap-4 sm:grid-cols-2",
}: {
  options: OrganizationFieldOptions;
  initialLocationId?: number | null;
  initialDepartmentId?: number | null;
  initialSubunitId?: number | null;
  initialCostCenterId?: number | null;
  requiredLocation?: boolean;
  requiredDepartment?: boolean;
  requiredSubunit?: boolean;
  requiredCostCenter?: boolean;
  showCostCenter?: boolean;
  locationFieldName?: "locationId" | "primaryLocationId";
  floatingLabel?: boolean;
  disabled?: boolean;
  errors?: Record<string, string>;
  className?: string;
}) {
  const [locationId, setLocationId] = useState<number | null>(initialLocationId);
  const [departmentId, setDepartmentId] = useState<number | null>(initialDepartmentId);
  const [subunitId, setSubunitId] = useState<number | null>(initialSubunitId);
  const [costCenterId, setCostCenterId] = useState<number | null>(() => {
    if (initialCostCenterId) return initialCostCenterId;
    const initialOptions = costCenterOptionsFor(initialLocationId, initialSubunitId, options);
    return initialOptions.length === 1 ? initialOptions[0].id : null;
  });

  const availableDepartments = useMemo(
    () => departmentOptionsFor(locationId, options),
    [locationId, options],
  );
  const availableSubunits = useMemo(
    () => subunitOptionsFor(locationId, departmentId, options),
    [departmentId, locationId, options],
  );
  const availableCostCenters = useMemo(() => {
    return costCenterOptionsFor(locationId, subunitId, options);
  }, [locationId, options, subunitId]);

  function changeLocation(nextLocationId: number | null) {
    setLocationId(nextLocationId);
    const nextDepartments = departmentOptionsFor(nextLocationId, options);
    if (!nextDepartments.some((department) => department.id === departmentId)) {
      setDepartmentId(null);
      setSubunitId(null);
      setCostCenterId(null);
      return;
    }

    const nextSubunits = subunitOptionsFor(nextLocationId, departmentId, options);
    if (!nextSubunits.some((subunit) => subunit.id === subunitId)) {
      setSubunitId(null);
      setCostCenterId(null);
      return;
    }

    const nextOptions = costCenterOptionsFor(nextLocationId, subunitId, options);
    if (!nextOptions.some((item) => item.id === costCenterId)) {
      setCostCenterId(nextOptions.length === 1 ? nextOptions[0].id : null);
    }
  }

  function changeDepartment(nextDepartmentId: number | null) {
    setDepartmentId(nextDepartmentId);
    const nextSubunits = subunitOptionsFor(locationId, nextDepartmentId, options);
    if (!nextSubunits.some((subunit) => subunit.id === subunitId)) {
      setSubunitId(null);
      setCostCenterId(null);
    }
  }

  function changeSubunit(nextSubunitId: number | null) {
    setSubunitId(nextSubunitId);
    const nextOptions = costCenterOptionsFor(locationId, nextSubunitId, options);
    if (!nextOptions.some((item) => item.id === costCenterId)) {
      setCostCenterId(nextOptions.length === 1 ? nextOptions[0].id : null);
    }
  }

  return (
    <div className={className}>
      <SearchableSelect
        key={`location-${initialLocationId}`}
        label="Office"
        name={locationFieldName}
        options={options.locations}
        placeholder="Search office..."
        required={requiredLocation}
        defaultValue={initialLocationId}
        onValueChange={changeLocation}
        disabled={disabled}
        floatingLabel={floatingLabel}
        error={errors?.locationId ?? errors?.primaryLocationId}
      />
      <SearchableSelect
        key={`department-${locationId ?? "none"}-${departmentId ?? "none"}`}
        label="Department"
        name="departmentId"
        options={availableDepartments}
        placeholder={!locationId
          ? "Select an office first"
          : availableDepartments.length
            ? "Search department..."
            : "No departments available for this office"}
        required={requiredDepartment}
        defaultValue={departmentId}
        onValueChange={changeDepartment}
        disabled={disabled || !locationId || availableDepartments.length === 0}
        floatingLabel={floatingLabel}
        error={errors?.departmentId}
      />
      <SearchableSelect
        key={`subunit-${locationId ?? "none"}-${departmentId ?? "none"}-${subunitId ?? "none"}`}
        label="Sub-unit"
        name="subunitId"
        options={availableSubunits}
        placeholder={!departmentId
          ? "Select a department first"
          : availableSubunits.length
            ? "Search sub-unit..."
            : "No sub-units available for this selection"}
        required={requiredSubunit && availableSubunits.length > 0}
        defaultValue={subunitId}
        onValueChange={changeSubunit}
        disabled={disabled || !departmentId || availableSubunits.length === 0}
        floatingLabel={floatingLabel}
        error={errors?.subunitId}
      />
      {showCostCenter && (
        <SearchableSelect
          key={`cost-center-${locationId ?? "none"}-${subunitId ?? "none"}-${costCenterId ?? "none"}`}
          label="Cost Center"
          name="costCenterId"
          options={availableCostCenters}
          placeholder={!locationId || !subunitId
            ? "Select office and sub-unit first"
            : availableCostCenters.length
              ? "Search cost center..."
              : "No cost centers available for this selection"}
          required={requiredCostCenter && availableCostCenters.length > 0}
          defaultValue={costCenterId}
          onValueChange={setCostCenterId}
          disabled={disabled || !locationId || !subunitId || availableCostCenters.length === 0}
          floatingLabel={floatingLabel}
          error={errors?.costCenterId}
        />
      )}
    </div>
  );
}

function departmentOptionsFor(
  locationId: number | null,
  options: OrganizationFieldOptions,
) {
  if (!locationId) return [];
  const mappedSubunitIds = new Set(
    options.mappings
      .filter((mapping) => mapping.locationId === locationId)
      .map((mapping) => mapping.subunitId),
  );
  const mappedDepartmentIds = new Set(
    options.subunits
      .filter((subunit) => mappedSubunitIds.has(subunit.id))
      .map((subunit) => subunit.departmentId),
  );
  return options.departments.filter((department) => mappedDepartmentIds.has(department.id));
}

function subunitOptionsFor(
  locationId: number | null,
  departmentId: number | null,
  options: OrganizationFieldOptions,
) {
  if (!locationId || !departmentId) return [];
  const mappedSubunitIds = new Set(
    options.mappings
      .filter((mapping) => mapping.locationId === locationId)
      .map((mapping) => mapping.subunitId),
  );
  return options.subunits.filter(
    (subunit) => subunit.departmentId === departmentId && mappedSubunitIds.has(subunit.id),
  );
}

function costCenterOptionsFor(
  locationId: number | null,
  subunitId: number | null,
  options: OrganizationFieldOptions,
) {
  if (!locationId || !subunitId) return [];
  const allowedIds = new Set(
    options.mappings
      .filter((mapping) => mapping.locationId === locationId && mapping.subunitId === subunitId)
      .map((mapping) => mapping.costCenterId),
  );
  return options.costCenters
    .filter((costCenter) => allowedIds.has(costCenter.id))
    .map((costCenter) => ({ id: costCenter.id, name: costCenter.code }));
}

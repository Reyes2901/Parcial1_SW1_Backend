package com.example.inventoryapp.dto;

import lombok.*;
import java.util.UUID;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ItemDTO {

    private UUID code;

    private String name;
}

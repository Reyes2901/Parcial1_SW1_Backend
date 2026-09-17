package com.example.inventoryapp.entity;

import jakarta.persistence.*;
import lombok.*;
import java.util.UUID;

@Entity
@Table(name = "books")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Book extends Item {


    @Column(name = "author", nullable = false)
    private String author;

}
